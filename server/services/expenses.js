import {
  addExpense,
  approvedParticipantIdsForTrip,
  deleteExpense,
  getBalances,
  getBudgetSummaryByTripId,
  getExpense,
  isValidExpenseInput
} from "../store.js";
import {
  createExpenseRecord,
  deleteExpenseRecord,
  findExpenseRecord,
  getBalancesRecord,
  getBudgetSummaryRecordByTripId,
  isExpenseRepositoryEnabled,
  listApprovedParticipantIdsRecord
} from "../repositories/expenses.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { isSupportedCurrencyCode, normalizeCurrencyCode } from "../utils/currency.js";
import { requireFields } from "../validators/request.js";
import { ensureApprovedParticipant, ensureOrganizer } from "./trips.js";

export async function createExpenseForTrip(userId, tripId, input = {}) {
  await ensureApprovedParticipant(userId, tripId);
  requireFields(input, ["title", "amount", "category", "payerId"]);

  if (!isValidExpenseInput(input)) {
    throw badRequest("Invalid expense input");
  }

  const participantIds = await getApprovedParticipantIds(tripId);
  const expenseType = input.expenseType || input.type;
  const includedParticipantIds = expenseType === "personal_advance"
    ? [String(input.payerId)]
    : input.includedParticipantIds?.length
    ? input.includedParticipantIds.map(String)
    : participantIds;

  ensureTripParticipant(input.payerId, participantIds, "Expense payer");

  for (const participantId of includedParticipantIds) {
    ensureTripParticipant(participantId, participantIds, "Expense split participant");
  }

  const expenseInput = {
    ...input,
    expenseType,
    currencyCode: normalizeExpenseCurrencyCode(input.currencyCode),
    splitRule: input.splitRule || "equal",
    includedParticipantIds
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

function normalizeExpenseCurrencyCode(currencyCode) {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  if (!isSupportedCurrencyCode(normalizedCurrencyCode)) {
    throw badRequest("Unsupported expense currency");
  }

  return normalizedCurrencyCode;
}

export async function deleteExpenseFromTrip(userId, tripId, expenseId) {
  await ensureApprovedParticipant(userId, tripId);

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
    ? await deleteExpenseRecord(tripId, expenseId)
    : deleteExpense(tripId, expenseId);

  return {
    deletedExpenseId: deletedExpense.id,
    budgetSummary: await getBudgetSummary(tripId),
    balances: (await getTripBalances(tripId)).balances
  };
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
