import { getDatabase } from "../db/pool.js";
import {
  DEFAULT_CURRENCY_CODE,
  normalizeCurrencyCode,
  splitCurrencyEvenly
} from "../utils/currency.js";

export function isExpenseRepositoryEnabled() {
  return getDatabase().enabled;
}

export async function listApprovedParticipantIdsRecord(tripId) {
  const result = await getDatabase().query(
    `
      SELECT user_id
      FROM trip_participants
      WHERE trip_id = $1
        AND join_status = 'approved'
      ORDER BY created_at ASC, user_id ASC
    `,
    [tripId]
  );

  return result.rows.map((row) => String(row.user_id));
}

//ADDED: currency exchange
export async function createExpenseRecord(tripId, input) {
  const database = getDatabase();
  const amount = roundCurrency(Number(input.amount));
  const currencyCode = normalizeCurrencyCode(input.currencyCode);
  const includedParticipantIds = input.expenseType === "personal_advance"
    ? [input.payerId]
    : [...input.includedParticipantIds];
  const expenseShares = splitCurrencyEvenly(amount, includedParticipantIds);

  const expenseId = await database.transaction(async (transaction) => {
    const splitRuleResult = await transaction.query(
      `
        SELECT id
        FROM split_rules
        WHERE type = $1
      `,
      [input.splitRule]
    );
    const splitRuleId = splitRuleResult.rows[0]?.id;

    const expenseResult = await transaction.query(
      `
        INSERT INTO expenses (
          trip_id,
          title,
          amount,
          category,
          expense_type,
          currency_code,
          payer_id,
          split_rule_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          trip_id,
          title,
          amount,
          category,
          expense_type,
          currency_code,
          payer_id,
          created_at
      `,
      [
        tripId,
        normalizeText(input.title) || "Untitled Expense",
        amount,
        input.category,
        input.expenseType,
        currencyCode,
        input.payerId,
        splitRuleId
      ]
    );

    const expenseId = expenseResult.rows[0].id;

    for (const share of expenseShares) {
      await transaction.query(
        `
          INSERT INTO expense_shares (
            expense_id,
            trip_id,
            participant_id,
            share_amount
          )
          VALUES ($1, $2, $3, $4)
        `,
        [expenseId, tripId, share.participantId, share.shareAmount]
      );
    }

    return expenseId;
  });

  return findExpenseRecord(tripId, expenseId);
}

export async function findExpenseRecord(tripId, expenseId) {
  const result = await getDatabase().query(
    `
      SELECT
        e.id,
        e.trip_id,
        e.title,
        e.amount,
        e.category,
        e.expense_type,
        COALESCE(e.currency_code, $3) AS currency_code,
        e.payer_id,
        sr.type AS split_rule,
        e.created_at
      FROM expenses e
      JOIN split_rules sr ON sr.id = e.split_rule_id
      WHERE e.trip_id = $1
        AND e.id = $2
    `,
    [tripId, expenseId, DEFAULT_CURRENCY_CODE]
  );

  if (!result.rows[0]) {
    return null;
  }

  const shares = await listExpenseShareRecords(expenseId);
  return mapExpenseRow(result.rows[0], shares);
}

export async function listExpenseRecordsForTrip(tripId) {
  const result = await getDatabase().query(
    `
      SELECT
        e.id,
        e.trip_id,
        e.title,
        e.amount,
        e.category,
        e.expense_type,
        COALESCE(e.currency_code, $2) AS currency_code,
        e.payer_id,
        sr.type AS split_rule,
        e.created_at
      FROM expenses e
      JOIN split_rules sr ON sr.id = e.split_rule_id
      WHERE e.trip_id = $1
      ORDER BY e.created_at ASC, e.id ASC
    `,
    [tripId, DEFAULT_CURRENCY_CODE]
  );

  return Promise.all(
    result.rows.map(async (row) => {
      const shares = await listExpenseShareRecords(row.id);
      return mapExpenseRow(row, shares);
    })
  );
}

export async function deleteExpenseRecord(tripId, expenseId) {
  const expense = await findExpenseRecord(tripId, expenseId);
  if (!expense) {
    return null;
  }

  await getDatabase().query(
    `
      DELETE FROM expenses
      WHERE trip_id = $1
        AND id = $2
    `,
    [tripId, expenseId]
  );

  return expense;
}

export async function getBudgetSummaryRecordByTripId(tripId) {
  const result = await getDatabase().query(
    `
      SELECT
        b.mode,
        b.total_budget,
        b.per_person_budget,
        COALESCE(b.currency_code, $2) AS currency_code,
        (
          SELECT COUNT(*)
          FROM trip_participants tp
          WHERE tp.trip_id = $1
            AND tp.join_status = 'approved'
        ) AS participant_count,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.trip_id = $1
        ), 0) AS total_spent
      FROM budgets b
      WHERE b.trip_id = $1
    `,
    [tripId, DEFAULT_CURRENCY_CODE]
  );

  if (!result.rows[0]) {
    return null;
  }

  return buildBudgetSummary(result.rows[0]);
}

export async function getBalancesRecord(tripId, { includeParticipant = false } = {}) {
  const result = await getDatabase().query(
    `
      SELECT
        tp.user_id AS participant_id,
        u.name,
        u.email,
        COALESCE(paid.actual_paid, 0) AS actual_paid,
        COALESCE(shares.fair_share, 0) AS fair_share
      FROM trip_participants tp
      JOIN users u ON u.id = tp.user_id
      LEFT JOIN (
        SELECT payer_id, SUM(amount) AS actual_paid
        FROM expenses
        WHERE trip_id = $1
        GROUP BY payer_id
      ) paid ON paid.payer_id = tp.user_id
      LEFT JOIN (
        SELECT participant_id, SUM(share_amount) AS fair_share
        FROM expense_shares
        WHERE trip_id = $1
        GROUP BY participant_id
      ) shares ON shares.participant_id = tp.user_id
      WHERE tp.trip_id = $1
        AND tp.join_status = 'approved'
      ORDER BY tp.created_at ASC, tp.user_id ASC
    `,
    [tripId]
  );

  return {
    tripId: String(tripId),
    balances: result.rows.map((row) => mapBalanceRow(row, includeParticipant))
  };
}

async function listExpenseShareRecords(expenseId) {
  const result = await getDatabase().query(
    `
      SELECT participant_id, share_amount
      FROM expense_shares
      WHERE expense_id = $1
      ORDER BY participant_id ASC
    `,
    [expenseId]
  );

  return result.rows.map((row) => ({
    participantId: String(row.participant_id),
    shareAmount: toCurrencyNumber(row.share_amount)
  }));
}

function mapExpenseRow(row, expenseShares) {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    title: row.title,
    amount: toCurrencyNumber(row.amount),
    category: row.category,
    expenseType: row.expense_type,
    currencyCode: String(row.currency_code || DEFAULT_CURRENCY_CODE).trim(),
    payerId: String(row.payer_id),
    splitRule: row.split_rule,
    includedParticipantIds: expenseShares.map((share) => share.participantId),
    expenseShares,
    createdAt: formatTimestamp(row.created_at)
  };
}

function mapBalanceRow(row, includeParticipant) {
  const actualPaid = toCurrencyNumber(row.actual_paid);
  const fairShare = toCurrencyNumber(row.fair_share);
  const balance = {
    participantId: String(row.participant_id),
    actualPaid,
    fairShare,
    netBalance: roundCurrency(actualPaid - fairShare)
  };

  if (!includeParticipant) {
    return balance;
  }

  return {
    ...balance,
    participant: {
      id: String(row.participant_id),
      name: row.name,
      email: row.email
    }
  };
}

function buildBudgetSummary(row) {
  const participantCount = Number(row.participant_count);
  const totalSpent = toCurrencyNumber(row.total_spent);
  const perPersonBudget = toNullableCurrencyNumber(row.per_person_budget);
  const totalBudget =
    row.mode === "per-person"
      ? roundCurrency(perPersonBudget * participantCount)
      : toCurrencyNumber(row.total_budget);

  return {
    mode: row.mode,
    totalBudget,
    perPersonBudget,
    currencyCode: String(row.currency_code || DEFAULT_CURRENCY_CODE).trim(),
    participantCount,
    totalSpent,
    remainingBudget: roundCurrency(Math.max(totalBudget - totalSpent, 0)),
    overBudgetAmount: roundCurrency(Math.max(totalSpent - totalBudget, 0))
  };
}

function formatTimestamp(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return new Date(value).toISOString();
  }

  return value.toISOString();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toNullableCurrencyNumber(value) {
  return value === null || value === undefined ? null : toCurrencyNumber(value);
}

function toCurrencyNumber(value) {
  return roundCurrency(Number(value || 0));
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}
