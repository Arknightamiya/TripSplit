import {
  addExpense,
  approvedParticipantIdsForTrip,
  deleteExpense,
  getBalances,
  getBudgetSummaryByTripId,
  getExpense,
  getTripById,
  isValidExpenseInput,
  listAuditLogsForTrip,
  restoreExpense
} from "../store.js";
import {
  createExpenseRecord,
  deleteExpenseRecord,
  findExpenseRecord,
  getBalancesRecord,
  getBudgetSummaryRecordByTripId,
  isExpenseRepositoryEnabled,
  listApprovedParticipantIdsRecord,
  listAuditLogRecordsForTrip,
  restoreExpenseRecord
} from "../repositories/expenses.js";
import { findTripRecordById } from "../repositories/trips.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { requireFields } from "../validators/request.js";
import { ensureApprovedParticipant, ensureOrganizer } from "./trips.js";

export async function createExpenseForTrip(userId, tripId, input = {}) {
  await ensureApprovedParticipant(userId, tripId);
  requireFields(input, ["title", "amount", "category"]);
  await ensureTripStartedForExpenses(tripId);

  const expenseType = normalizeExpenseType(input.expenseType || input.type);
  const payerId = expenseType === "budget_payment" ? String(userId) : input.payerId;
  const normalizedInput = {
    ...input,
    expenseType,
    payerId,
    splitRule: input.splitRule || "equal"
  };

  if (!payerId) {
    throw badRequest("Expense payer is required");
  }

  if (!isValidExpenseInput(normalizedInput)) {
    throw badRequest("Invalid expense input");
  }

  if (expenseType === "budget_payment") {
    await ensureOrganizer(userId, tripId);
  }

  const participantIds = await getApprovedParticipantIds(tripId);
  const includedParticipantIds = normalizeIncludedParticipantIds(
    input.includedParticipantIds,
    expenseType,
    payerId
  );

  if (!includedParticipantIds.length) {
    throw badRequest(
      expenseType === "personal_advance"
        ? "Choose at least one person who should reimburse the payer"
        : "At least one split participant is required"
    );
  }

  ensureTripParticipant(payerId, participantIds, "Expense payer");

  for (const participantId of includedParticipantIds) {
    ensureTripParticipant(participantId, participantIds, "Expense split participant");
  }

  const expenseInput = {
    ...normalizedInput,
    includedParticipantIds,
    actorId: userId
  };

  const expense = isExpenseRepositoryEnabled()
    ? await createExpenseRecord(tripId, expenseInput)
    : addExpense(tripId, expenseInput);

  return {
    expense,
    budgetSummary: await getBudgetSummary(tripId),
    balances: (await getTripBalances(tripId)).balances
  };
}

async function ensureTripStartedForExpenses(tripId) {
  const trip = isExpenseRepositoryEnabled()
    ? await findTripRecordById(tripId)
    : getTripById(tripId);

  if (!trip) {
    throw notFound("Trip not found");
  }

  if (!trip.startedAt) {
    throw badRequest("Start the trip before recording expenses");
  }

  if (trip.endedAt) {
    throw badRequest("Trip has ended; expenses are locked");
  }
}

export async function deleteExpenseFromTrip(userId, tripId, expenseId) {
  await ensureApprovedParticipant(userId, tripId);
  await ensureTripOpenForExpenseDeletion(tripId);

  const expense = isExpenseRepositoryEnabled()
    ? await findExpenseRecord(tripId, expenseId)
    : getExpense(tripId, expenseId);
  if (!expense) {
    throw notFound("Expense not found");
  }

  if (expense.payerId !== userId) {
    try {
      await ensureOrganizer(userId, tripId);
    } catch (error) {
      if (error.statusCode === 403) {
        throw forbidden("Only the expense payer or trip organizer can delete this expense");
      }

      throw error;
    }
  }

  const deletedExpense = isExpenseRepositoryEnabled()
    ? await deleteExpenseRecord(tripId, expenseId, userId)
    : deleteExpense(tripId, expenseId, userId);

  return {
    deletedExpenseId: deletedExpense.id,
    deletedExpense,
    auditLogs: await getAuditLogs(tripId),
    budgetSummary: await getBudgetSummary(tripId),
    balances: (await getTripBalances(tripId)).balances
  };
}

export async function restoreExpenseForTrip(userId, tripId, expenseId) {
  await ensureOrganizer(userId, tripId);
  await ensureTripOpenForExpenseDeletion(tripId);

  const expense = isExpenseRepositoryEnabled()
    ? await findExpenseRecord(tripId, expenseId, { includeDeleted: true })
    : getExpense(tripId, expenseId);
  if (!expense) {
    throw notFound("Expense not found");
  }

  if (!expense.deletedAt) {
    throw badRequest("Expense is not deleted");
  }

  const restoredExpense = isExpenseRepositoryEnabled()
    ? await restoreExpenseRecord(tripId, expenseId, userId)
    : restoreExpense(tripId, expenseId, userId);

  return {
    restoredExpenseId: restoredExpense.id,
    restoredExpense,
    auditLogs: await getAuditLogs(tripId),
    budgetSummary: await getBudgetSummary(tripId),
    balances: (await getTripBalances(tripId)).balances
  };
}

async function ensureTripOpenForExpenseDeletion(tripId) {
  const trip = isExpenseRepositoryEnabled()
    ? await findTripRecordById(tripId)
    : getTripById(tripId);

  if (!trip) {
    throw notFound("Trip not found");
  }

  if (trip.endedAt) {
    throw badRequest("Trip has ended; expenses are locked");
  }
}

export async function getBalancesForTrip(userId, tripId) {
  await ensureApprovedParticipant(userId, tripId);

  return getTripBalances(tripId, {
    includeParticipant: true
  });
}

function ensureTripParticipant(userId, participantIds, label) {
  if (!participantIds.includes(String(userId))) {
    throw badRequest(`${label} must be an approved trip participant`);
  }
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(String)));
}

function normalizeIncludedParticipantIds(values, expenseType, payerId) {
  const participantIds = Array.isArray(values)
    ? uniqueStrings(values)
    : [];

  if (expenseType !== "personal_advance") {
    return participantIds;
  }

  return participantIds.filter((participantId) => participantId !== String(payerId));
}

function normalizeExpenseType(expenseType) {
  return expenseType === "shared" ? "personal_advance" : expenseType;
}

async function getApprovedParticipantIds(tripId) {
  if (isExpenseRepositoryEnabled()) {
    return listApprovedParticipantIdsRecord(tripId);
  }

  return approvedParticipantIdsForTrip(tripId);
}

async function getBudgetSummary(tripId) {
  if (isExpenseRepositoryEnabled()) {
    return getBudgetSummaryRecordByTripId(tripId);
  }

  return getBudgetSummaryByTripId(tripId);
}

async function getTripBalances(tripId, options) {
  if (isExpenseRepositoryEnabled()) {
    return getBalancesRecord(tripId, options);
  }

  return getBalances(tripId, options);
}

async function getAuditLogs(tripId) {
  if (isExpenseRepositoryEnabled()) {
    return listAuditLogRecordsForTrip(tripId);
  }

  return listAuditLogsForTrip(tripId);
}
