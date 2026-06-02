import { getDatabase } from "../db/pool.js";
import { normalizeCurrencyAmount } from "../utils/currency.js";
import { listAuditLogRecordsForTrip, listExpenseRecordsForTrip } from "./expenses.js";

export function isTripRepositoryEnabled() {
  return getDatabase().enabled;
}

export async function createTripRecord({
  name,
  destination,
  startDate,
  endDate,
  visibility,
  organizerId,
  invitedParticipantIds = []
}) {
  const database = getDatabase();

  const tripId = await database.transaction(async (client) => {
    const tripResult = await client.query(
      `
        INSERT INTO trips (name, destination, start_date, end_date, visibility, organizer_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [
        name,
        destination || null,
        startDate || null,
        endDate || null,
        visibility === "public" ? "public" : "private",
        organizerId
      ]
    );
    const createdTripId = tripResult.rows[0].id;

    await client.query(
      `
        INSERT INTO trip_participants (trip_id, user_id, role, join_status)
        VALUES ($1, $2, 'organizer', 'approved')
      `,
      [createdTripId, organizerId]
    );

    for (const invitedParticipantId of invitedParticipantIds) {
      await client.query(
        `
          INSERT INTO trip_participants (trip_id, user_id, role, join_status)
          VALUES ($1, $2, 'participant', 'pending')
        `,
        [createdTripId, invitedParticipantId]
      );
    }

    return createdTripId;
  });

  return findTripRecordById(tripId);
}

export async function addParticipantRecord(tripId, { userId, role }) {
  await getDatabase().query(
    `
      INSERT INTO trip_participants (trip_id, user_id, role, join_status)
      VALUES ($1, $2, $3, 'approved')
      ON CONFLICT (trip_id, user_id)
      DO UPDATE SET
        role = CASE
          WHEN trip_participants.role = 'organizer' THEN 'organizer'
          ELSE EXCLUDED.role
        END,
        join_status = 'approved'
    `,
    [tripId, userId, role]
  );

  return findTripRecordById(tripId);
}

export async function inviteParticipantRecord(tripId, { userId, role = "participant" }) {
  await getDatabase().query(
    `
      INSERT INTO trip_participants (trip_id, user_id, role, join_status)
      VALUES ($1, $2, $3, 'pending')
      ON CONFLICT (trip_id, user_id)
      DO UPDATE SET
        role = CASE
          WHEN trip_participants.role = 'organizer' THEN 'organizer'
          ELSE EXCLUDED.role
        END,
        join_status = CASE
          WHEN trip_participants.join_status = 'approved' THEN 'approved'
          ELSE 'pending'
        END
    `,
    [tripId, userId, role]
  );

  return findTripRecordById(tripId);
}

export async function findTripParticipantRecord(tripId, userId) {
  const result = await getDatabase().query(
    `
      SELECT trip_id, user_id, role, join_status
      FROM trip_participants
      WHERE trip_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [tripId, userId]
  );

  const row = result.rows[0];
  return row
    ? {
        tripId: String(row.trip_id),
        userId: String(row.user_id),
        role: row.role,
        joinStatus: row.join_status
      }
    : null;
}

export async function removeParticipantRecord(tripId, userId) {
  const trip = await findTripRecordById(tripId);
  if (!trip) {
    return null;
  }

  const result = await getDatabase().transaction(async (client) => {
    await client.query(
      `
        DELETE FROM balance_summaries
        WHERE trip_id = $1
          AND participant_id = $2
      `,
      [tripId, userId]
    );
    await client.query(
      `
        DELETE FROM expense_shares
        WHERE trip_id = $1
          AND participant_id = $2
      `,
      [tripId, userId]
    );
    return client.query(
      `
        DELETE FROM trip_participants
        WHERE trip_id = $1
          AND user_id = $2
          AND role <> 'organizer'
        RETURNING user_id
      `,
      [tripId, userId]
    );
  });

  return result.rowCount > 0 ? findTripRecordById(tripId) : null;
}

export async function updateTripRecord(tripId, {
  name,
  destination,
  startDate,
  endDate,
  visibility
}) {
  const result = await getDatabase().query(
    `
      UPDATE trips
      SET
        name = $2,
        destination = $3,
        start_date = $4,
        end_date = $5,
        visibility = $6
      WHERE id = $1
      RETURNING id
    `,
    [
      tripId,
      name,
      destination || null,
      startDate || null,
      endDate || null,
      visibility === "public" ? "public" : "private"
    ]
  );

  return result.rows[0] ? findTripRecordById(tripId) : null;
}

export async function startTripRecord(tripId) {
  const result = await getDatabase().query(
    `
      UPDATE trips
      SET started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
      WHERE id = $1
      RETURNING id
    `,
    [tripId]
  );

  return result.rows[0] ? findTripRecordById(tripId) : null;
}

export async function endTripRecord(tripId) {
  const result = await getDatabase().query(
    `
      UPDATE trips
      SET ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
      WHERE id = $1
      RETURNING id
    `,
    [tripId]
  );

  return result.rows[0] ? findTripRecordById(tripId) : null;
}

export async function setBudgetRecord(tripId, budgetInput) {
  const mode = budgetInput.mode;
  const totalBudget =
    mode === "total"
      ? normalizeCurrencyAmount(budgetInput.totalBudget ?? budgetInput.amount)
      : null;
  const perPersonBudget =
    mode === "per-person"
      ? normalizeCurrencyAmount(budgetInput.perPersonBudget ?? budgetInput.amount)
      : null;

  await getDatabase().query(
    `
      INSERT INTO budgets (trip_id, mode, total_budget, per_person_budget)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (trip_id)
      DO UPDATE SET
        mode = EXCLUDED.mode,
        total_budget = EXCLUDED.total_budget,
        per_person_budget = EXCLUDED.per_person_budget,
        updated_at = CURRENT_TIMESTAMP
    `,
    [tripId, mode, totalBudget, perPersonBudget]
  );

  return (await findTripRecordById(tripId))?.budgetSummary ?? null;
}

export async function deleteTripRecord(tripId) {
  const trip = await findTripRecordById(tripId);
  if (!trip) {
    return null;
  }

  await getDatabase().transaction(async (client) => {
    await client.query("DELETE FROM balance_summaries WHERE trip_id = $1", [tripId]);
    await client.query("DELETE FROM expense_shares WHERE trip_id = $1", [tripId]);
    await client.query("DELETE FROM expenses WHERE trip_id = $1", [tripId]);
    await client.query("DELETE FROM budgets WHERE trip_id = $1", [tripId]);
    await client.query("DELETE FROM trip_participants WHERE trip_id = $1", [tripId]);
    await client.query("DELETE FROM trips WHERE id = $1", [tripId]);
  });

  return trip;
}

export async function listTripSummaryRecordsForUser(userId) {
  const result = await getDatabase().query(
    `
      SELECT
        t.id,
        t.name,
        t.destination,
        t.start_date,
        t.end_date,
        t.visibility,
        t.organizer_id,
        t.started_at,
        t.ended_at,
        organizer.name AS organizer_name,
        organizer.display_name AS organizer_display_name,
        b.mode,
        b.total_budget,
        b.per_person_budget,
        (
          SELECT COUNT(*)
          FROM trip_participants approved_tp
          WHERE approved_tp.trip_id = t.id
            AND approved_tp.join_status = 'approved'
        ) AS participant_count,
        (
          SELECT COUNT(*)
          FROM expenses e
          WHERE e.trip_id = t.id
            AND e.deleted_at IS NULL
        ) AS expense_count,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.trip_id = t.id
            AND e.expense_type = 'budget_payment'
            AND e.deleted_at IS NULL
        ), 0) AS total_spent
      FROM trips t
      JOIN trip_participants tp ON tp.trip_id = t.id
      JOIN users organizer ON organizer.id = t.organizer_id
      LEFT JOIN budgets b ON b.trip_id = t.id
      WHERE tp.user_id = $1
        AND tp.join_status = 'approved'
      ORDER BY t.created_at DESC, t.id DESC
    `,
    [userId]
  );

  return result.rows.map(mapTripSummaryRow);
}

export async function findTripRecordById(tripId) {
  const tripResult = await getDatabase().query(
    `
      SELECT
        t.id,
        t.name,
        t.destination,
        t.start_date,
        t.end_date,
        t.visibility,
        t.organizer_id,
        t.started_at,
        t.ended_at,
        b.mode,
        b.total_budget,
        b.per_person_budget,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.trip_id = t.id
            AND e.expense_type = 'budget_payment'
            AND e.deleted_at IS NULL
        ), 0) AS total_spent
      FROM trips t
      LEFT JOIN budgets b ON b.trip_id = t.id
      WHERE t.id = $1
    `,
    [tripId]
  );

  if (!tripResult.rows[0]) {
    return null;
  }

  const participants = await listParticipantRecordsForTrip(tripId);
  const participantCount = participants.filter(
    (participant) => participant.joinStatus === "approved"
  ).length;

  const expenses = await listExpenseRecordsForTrip(tripId);
  const deletedExpenses = await listExpenseRecordsForTrip(tripId, { onlyDeleted: true });
  const auditLogs = await listAuditLogRecordsForTrip(tripId);

  return mapTripDetailRow(
    tripResult.rows[0],
    participants,
    participantCount,
    expenses,
    deletedExpenses,
    auditLogs
  );
}

export async function tripRecordExists(tripId) {
  const result = await getDatabase().query(
    `
      SELECT 1
      FROM trips
      WHERE id = $1
    `,
    [tripId]
  );

  return Boolean(result.rows[0]);
}

export async function userIsApprovedParticipantRecord(userId, tripId) {
  const result = await getDatabase().query(
    `
      SELECT 1
      FROM trip_participants
      WHERE trip_id = $1
        AND user_id = $2
        AND join_status = 'approved'
    `,
    [tripId, userId]
  );

  return Boolean(result.rows[0]);
}

export async function userIsOrganizerRecord(userId, tripId) {
  const result = await getDatabase().query(
    `
      SELECT 1
      FROM trip_participants
      WHERE trip_id = $1
        AND user_id = $2
        AND role = 'organizer'
        AND join_status = 'approved'
    `,
    [tripId, userId]
  );

  return Boolean(result.rows[0]);
}

async function listParticipantRecordsForTrip(tripId) {
  const result = await getDatabase().query(
    `
      SELECT
        u.id,
        u.name,
        u.display_name,
        u.email,
        u.avatar_url,
        tp.role,
        tp.join_status
      FROM trip_participants tp
      JOIN users u ON u.id = tp.user_id
      WHERE tp.trip_id = $1
      ORDER BY tp.created_at ASC, u.id ASC
    `,
    [tripId]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    displayName: row.display_name || row.name,
    userId: row.name,
    email: row.email,
    avatarUrl: row.avatar_url || "",
    role: row.role,
    joinStatus: row.join_status
  }));
}

function mapTripSummaryRow(row) {
  const participantCount = Number(row.participant_count);
  const totalSpent = toCurrencyNumber(row.total_spent);

  return {
    id: String(row.id),
    name: row.name,
    destination: row.destination || "TBD",
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    visibility: row.visibility || "private",
    organizerId: String(row.organizer_id),
    organizerName: row.organizer_display_name || row.organizer_name || "Organizer",
    startedAt: formatTimestamp(row.started_at),
    endedAt: formatTimestamp(row.ended_at),
    participantCount,
    expenseCount: Number(row.expense_count),
    budgetSummary: buildBudgetSummary(row, participantCount, totalSpent)
  };
}

function mapTripDetailRow(row, participants, participantCount, expenses = [], deletedExpenses = [], auditLogs = []) {
  const totalSpent = toCurrencyNumber(row.total_spent);

  return {
    id: String(row.id),
    name: row.name,
    destination: row.destination || "TBD",
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    visibility: row.visibility || "private",
    organizerId: String(row.organizer_id),
    startedAt: formatTimestamp(row.started_at),
    endedAt: formatTimestamp(row.ended_at),
    participantIds: participants
      .filter((participant) => participant.joinStatus === "approved")
      .map((participant) => participant.id),
    participants,
    budgetSummary: buildBudgetSummary(row, participantCount, totalSpent),
    expenses,
    deletedExpenses,
    auditLogs
  };
}

function buildBudgetSummary(row, participantCount, totalSpent) {
  if (!row.mode) {
    return null;
  }

  const perPersonBudget = toNullableCurrencyNumber(row.per_person_budget);
  const totalBudget =
    row.mode === "per-person"
      ? roundCurrency(perPersonBudget * participantCount)
      : toCurrencyNumber(row.total_budget);
  const remainingBudget = roundCurrency(Math.max(totalBudget - totalSpent, 0));
  const overBudgetAmount = roundCurrency(Math.max(totalSpent - totalBudget, 0));

  return {
    mode: row.mode,
    totalBudget,
    perPersonBudget,
    participantCount,
    totalSpent,
    remainingBudget,
    overBudgetAmount
  };
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function formatTimestamp(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toISOString();
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
