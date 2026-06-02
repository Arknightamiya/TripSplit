import { getDatabase } from "../db/pool.js";
import { calculateBalances } from "../settlement.js";
import { normalizeCurrencyAmount, splitCurrencyEvenly } from "../utils/currency.js";

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

export async function createExpenseRecord(tripId, input) {
  const database = getDatabase();
  const amount = normalizeCurrencyAmount(input.amount);
  const includedParticipantIds = uniqueStrings(input.includedParticipantIds || []);
  const expenseShares = createExpenseShares(amount, input.expenseType, input.payerId, includedParticipantIds);

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
          payer_id,
          split_rule_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          trip_id,
          title,
          amount,
          category,
          expense_type,
          payer_id,
          created_at,
          deleted_at,
          deleted_by
      `,
      [
        tripId,
        normalizeText(input.title) || "Untitled Expense",
        amount,
        input.category,
        input.expenseType,
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

    await insertAuditLog(transaction, {
      tripId,
      actorId: input.actorId || input.payerId,
      action: "expense.created",
      targetType: "expense",
      targetId: expenseId
    });

    return expenseId;
  });

  return findExpenseRecord(tripId, expenseId);
}

export async function findExpenseRecord(tripId, expenseId, { includeDeleted = false } = {}) {
  const result = await getDatabase().query(
    `
      SELECT
        e.id,
        e.trip_id,
        e.title,
        e.amount,
        e.category,
        e.expense_type,
        e.payer_id,
        sr.type AS split_rule,
        e.created_at,
        e.deleted_at,
        e.deleted_by
      FROM expenses e
      JOIN split_rules sr ON sr.id = e.split_rule_id
      WHERE e.trip_id = $1
        AND e.id = $2
        ${includeDeleted ? "" : "AND e.deleted_at IS NULL"}
    `,
    [tripId, expenseId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const shares = await listExpenseShareRecords(expenseId);
  return mapExpenseRow(result.rows[0], shares);
}

export async function listExpenseRecordsForTrip(tripId, { includeDeleted = false, onlyDeleted = false } = {}) {
  const deletedFilter = onlyDeleted
    ? "AND e.deleted_at IS NOT NULL"
    : includeDeleted
      ? ""
      : "AND e.deleted_at IS NULL";
  const result = await getDatabase().query(
    `
      SELECT
        e.id,
        e.trip_id,
        e.title,
        e.amount,
        e.category,
        e.expense_type,
        e.payer_id,
        sr.type AS split_rule,
        e.created_at,
        e.deleted_at,
        e.deleted_by
      FROM expenses e
      JOIN split_rules sr ON sr.id = e.split_rule_id
      WHERE e.trip_id = $1
        ${deletedFilter}
      ORDER BY e.created_at ASC, e.id ASC
    `,
    [tripId]
  );

  return Promise.all(
    result.rows.map(async (row) => {
      const shares = await listExpenseShareRecords(row.id);
      return mapExpenseRow(row, shares);
    })
  );
}

export async function deleteExpenseRecord(tripId, expenseId, actorId) {
  const expense = await findExpenseRecord(tripId, expenseId);
  if (!expense) {
    return null;
  }

  await getDatabase().transaction(async (transaction) => {
    await transaction.query(
      `
        UPDATE expenses
        SET deleted_at = CURRENT_TIMESTAMP,
            deleted_by = $3
        WHERE trip_id = $1
          AND id = $2
          AND deleted_at IS NULL
      `,
      [tripId, expenseId, actorId]
    );
    await insertAuditLog(transaction, {
      tripId,
      actorId,
      action: "expense.deleted",
      targetType: "expense",
      targetId: expenseId
    });
  });

  return findExpenseRecord(tripId, expenseId, { includeDeleted: true });
}

export async function restoreExpenseRecord(tripId, expenseId, actorId) {
  const expense = await findExpenseRecord(tripId, expenseId, { includeDeleted: true });
  if (!expense || !expense.deletedAt) {
    return null;
  }

  await getDatabase().transaction(async (transaction) => {
    await transaction.query(
      `
        UPDATE expenses
        SET deleted_at = NULL,
            deleted_by = NULL
        WHERE trip_id = $1
          AND id = $2
          AND deleted_at IS NOT NULL
      `,
      [tripId, expenseId]
    );
    await insertAuditLog(transaction, {
      tripId,
      actorId,
      action: "expense.restored",
      targetType: "expense",
      targetId: expenseId
    });
  });

  return findExpenseRecord(tripId, expenseId);
}

export async function listAuditLogRecordsForTrip(tripId) {
  const result = await getDatabase().query(
    `
      SELECT id, trip_id, actor_id, action, target_type, target_id, created_at
      FROM audit_logs
      WHERE trip_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [tripId]
  );

  return result.rows.map(mapAuditLogRow);
}

export async function getBudgetSummaryRecordByTripId(tripId) {
  const result = await getDatabase().query(
    `
      SELECT
        b.mode,
        b.total_budget,
        b.per_person_budget,
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
            AND e.expense_type = 'budget_payment'
            AND e.deleted_at IS NULL
        ), 0) AS total_spent
      FROM budgets b
      WHERE b.trip_id = $1
    `,
    [tripId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return buildBudgetSummary(result.rows[0]);
}

export async function getBalancesRecord(tripId, { includeParticipant = false } = {}) {
  const participants = await listApprovedParticipantRecords(tripId);
  const expenses = await listExpenseRecordsForTrip(tripId);
  const balances = calculateBalances({
    participantIds: participants.map((participant) => participant.id),
    expenses
  }).map((balance) => {
    if (!includeParticipant) {
      return balance;
    }

    return {
      ...balance,
      participant: participants.find(
        (participant) => participant.id === balance.participantId
      )
    };
  });

  return {
    tripId: String(tripId),
    balances
  };
}

async function listApprovedParticipantRecords(tripId) {
  const result = await getDatabase().query(
    `
      SELECT
        tp.user_id AS participant_id,
        u.name,
        u.display_name,
        u.email
      FROM trip_participants tp
      JOIN users u ON u.id = tp.user_id
      WHERE tp.trip_id = $1
        AND tp.join_status = 'approved'
      ORDER BY tp.created_at ASC, tp.user_id ASC
    `,
    [tripId]
  );

  return result.rows.map((row) => ({
    id: String(row.participant_id),
    name: row.name,
    displayName: row.display_name || row.name,
    email: row.email
  }));
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
  const expenseType = normalizeExpenseType(row.expense_type);
  const normalizedExpenseShares = normalizeExpenseShares(row, expenseShares);

  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    title: row.title,
    amount: toCurrencyNumber(row.amount),
    category: row.category,
    expenseType,
    payerId: String(row.payer_id),
    splitRule: row.split_rule,
    includedParticipantIds: normalizedExpenseShares.map((share) => share.participantId),
    expenseShares: normalizedExpenseShares,
    createdAt: formatTimestamp(row.created_at),
    deletedAt: formatTimestamp(row.deleted_at),
    deletedBy: row.deleted_by === null || row.deleted_by === undefined
      ? null
      : String(row.deleted_by)
  };
}

async function insertAuditLog(transaction, { tripId, actorId, action, targetType, targetId }) {
  await transaction.query(
    `
      INSERT INTO audit_logs (trip_id, actor_id, action, target_type, target_id)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [tripId, actorId || null, action, targetType, targetId || null]
  );
}

function mapAuditLogRow(row) {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    actorId: row.actor_id === null || row.actor_id === undefined ? null : String(row.actor_id),
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id === null || row.target_id === undefined ? null : String(row.target_id),
    createdAt: formatTimestamp(row.created_at)
  };
}

function normalizeExpenseShares(row, expenseShares) {
  const amount = toCurrencyNumber(row.amount);
  const payerId = String(row.payer_id);
  const expenseType = normalizeExpenseType(row.expense_type);

  if (!sharesNeedRecalculation(amount, expenseType, payerId, expenseShares)) {
    return expenseShares;
  }

  const participantIds = uniqueStrings(expenseShares.map((share) => share.participantId));
  return createExpenseShares(amount, expenseType, payerId, participantIds);
}

function normalizeExpenseType(expenseType) {
  return expenseType === "shared" ? "personal_advance" : expenseType;
}

function sharesNeedRecalculation(amount, expenseType, payerId, expenseShares) {
  if (!expenseShares.length) {
    return true;
  }

  const participantIds = expenseShares.map((share) => String(share.participantId));
  if (new Set(participantIds).size !== participantIds.length) {
    return true;
  }

  const shareTotal = roundCurrency(
    expenseShares.reduce((sum, share) => sum + Number(share.shareAmount), 0)
  );

  if (expenseType === "personal_advance") {
    if (participantIds.includes(String(payerId))) {
      return true;
    }

    const expectedTotal = roundCurrency(
      createPersonalAdvanceShares(amount, payerId, participantIds).reduce(
        (sum, share) => sum + Number(share.shareAmount),
        0
      )
    );
    return shareTotal !== expectedTotal;
  }

  return shareTotal !== roundCurrency(Number(amount));
}

function createExpenseShares(amount, expenseType, payerId, includedParticipantIds) {
  if (normalizeExpenseType(expenseType) === "personal_advance") {
    return createPersonalAdvanceShares(amount, payerId, includedParticipantIds);
  }

  const participantIds = includedParticipantIds.length ? includedParticipantIds : [payerId];
  return splitCurrencyEvenly(amount, participantIds);
}

function createPersonalAdvanceShares(amount, payerId, includedParticipantIds) {
  const normalizedPayerId = String(payerId);
  const debtorIds = uniqueStrings(includedParticipantIds)
    .filter((participantId) => participantId !== normalizedPayerId);

  if (!debtorIds.length) {
    return [];
  }

  return splitCurrencyEvenly(amount, [normalizedPayerId, ...debtorIds])
    .filter((share) => String(share.participantId) !== normalizedPayerId);
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

function uniqueStrings(values) {
  return Array.from(new Set(values.map(String)));
}
