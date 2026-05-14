import {
  addExpense,
  approvedParticipantIdsForTrip,
  deleteExpense,
  getBalances,
  getBudgetSummaryByTripId,
  getExpense,
  isOrganizer,
  isValidExpenseInput
} from "../store.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { requireFields } from "../validators/request.js";
import { ensureApprovedParticipant } from "./trips.js";

export function createExpenseForTrip(userId, tripId, input = {}) {
  ensureApprovedParticipant(userId, tripId);
  requireFields(input, ["title", "amount", "category", "payerId"]);

  if (!isValidExpenseInput(input)) {
    throw badRequest("Invalid expense input");
  }

  const includedParticipantIds = input.includedParticipantIds?.length
    ? input.includedParticipantIds
    : approvedParticipantIdsForTrip(tripId);
  const participantIds = approvedParticipantIdsForTrip(tripId);

  ensureTripParticipant(input.payerId, participantIds, "Expense payer");

  for (const participantId of includedParticipantIds) {
    ensureTripParticipant(participantId, participantIds, "Expense split participant");
  }

  const expense = addExpense(tripId, {
    ...input,
    splitRule: input.splitRule || "equal",
    includedParticipantIds
  });

  return {
    expense,
    budgetSummary: getBudgetSummaryByTripId(tripId),
    balances: getBalances(tripId).balances
  };
}

export function deleteExpenseFromTrip(userId, tripId, expenseId) {
  ensureApprovedParticipant(userId, tripId);

  const expense = getExpense(tripId, expenseId);
  if (!expense) {
    throw notFound("Expense not found");
  }

  if (expense.payerId !== userId && !isOrganizer(tripId, userId)) {
    throw forbidden("Only the expense payer or trip organizer can delete this expense");
  }

  const deletedExpense = deleteExpense(tripId, expenseId);

  return {
    deletedExpenseId: deletedExpense.id,
    budgetSummary: getBudgetSummaryByTripId(tripId),
    balances: getBalances(tripId).balances
  };
}

export function getBalancesForTrip(userId, tripId) {
  ensureApprovedParticipant(userId, tripId);

  return getBalances(tripId, {
    includeParticipant: true
  });
}

function ensureTripParticipant(userId, participantIds, label) {
  if (!participantIds.includes(userId)) {
    throw badRequest(`${label} must be an approved trip participant`);
  }
}
