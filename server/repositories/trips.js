import { getDatabase } from "../db/pool.js";
import { listExpenseRecordsForTrip } from "./expenses.js";

export function isTripRepositoryEnabled() {
  return getDatabase().enabled;
}

export async function createTripRecord({
  name,
  destination,
  startDate,
  endDate,
  organizerId
}) {
  const database = getDatabase();

  try {
    await database.query("BEGIN");

    const tripResult = await database.query(
      `
        INSERT INTO trips (name, destination, start_date, end_date, organizer_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [name, destination || null, startDate || null, endDate || null, organizerId]
    );
    const tripId = tripResult.rows[0].id;

    await database.query(
      `
        INSERT INTO trip_participants (trip_id, user_id, role, join_status)
        VALUES ($1, $2, 'organizer', 'approved')
      `,
      [tripId, organizerId]
    );

    await database.query("COMMIT");
    return findTripRecordById(tripId);
  } catch (error) {
    await database.query("ROLLBACK");
    throw error;
  }
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
        t.organizer_id,
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
        ) AS expense_count,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.trip_id = t.id
        ), 0) AS total_spent
      FROM trips t
      JOIN trip_participants tp ON tp.trip_id = t.id
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
        t.organizer_id,
        b.mode,
        b.total_budget,
        b.per_person_budget,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.trip_id = t.id
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

  return mapTripDetailRow(
    tripResult.rows[0],
    participants,
    participantCount,
    expenses
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
        u.email,
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
    email: row.email,
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
    organizerId: String(row.organizer_id),
    participantCount,
    expenseCount: Number(row.expense_count),
    budgetSummary: buildBudgetSummary(row, participantCount, totalSpent)
  };
}

function mapTripDetailRow(row, participants, participantCount, expenses = []) {
  const totalSpent = toCurrencyNumber(row.total_spent);

  return {
    id: String(row.id),
    name: row.name,
    destination: row.destination || "TBD",
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    organizerId: String(row.organizer_id),
    participantIds: participants
      .filter((participant) => participant.joinStatus === "approved")
      .map((participant) => participant.id),
    participants,
    budgetSummary: buildBudgetSummary(row, participantCount, totalSpent),
    expenses
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

function toNullableCurrencyNumber(value) {
  return value === null || value === undefined ? null : toCurrencyNumber(value);
}

function toCurrencyNumber(value) {
  return roundCurrency(Number(value || 0));
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}
