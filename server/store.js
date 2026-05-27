import {
  BUDGET_MODES,
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES,
  SPLIT_RULES
} from "../shared/contracts.js";
import { calculateBalances } from "./settlement.js";

const state = {
  nextId: 1,
  users: [],
  trips: []
};

export function resetStore() {
  state.nextId = 1;
  state.users = [];
  state.trips = [];
}

export function listUsers() {
  return clone(state.users.map(toSafeUser));
}

export function createUser({ name, email, passwordHash, displayName, avatarUrl }) {
  const normalizedName = normalizeText(name) || "Unnamed User";
  const user = {
    id: createId("user"),
    name: normalizedName,
    displayName: normalizeText(displayName) || normalizedName,
    email: normalizeEmail(email),
    passwordHash,
    avatarUrl: normalizeText(avatarUrl) || ""
  };

  state.users.push(user);
  return clone(toSafeUser(user));
}

export function updateUserProfile(userId, { displayName, avatarUrl }) {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) {
    return null;
  }

  user.displayName = normalizeText(displayName) || user.name;
  user.avatarUrl = normalizeText(avatarUrl) || "";

  return clone(toSafeUser(user));
}

export function findUserById(userId) {
  const user = state.users.find((entry) => entry.id === userId);
  return user ? clone(user) : null;
}

export function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const user = state.users.find((entry) => entry.email === normalizedEmail);
  return user ? clone(user) : null;
}

export function findUserByName(name) {
  const normalizedName = normalizeText(name).toLowerCase();
  const user = state.users.find((entry) => entry.name.toLowerCase() === normalizedName);
  return user ? clone(user) : null;
}

export function listTripSummariesForUser(userId) {
  return state.trips
    .filter((trip) => isApprovedParticipant(trip.id, userId))
    .map((trip) => summarizeTrip(trip));
}

export function createTrip({ name, destination, startDate, endDate, organizerId }) {
  const trip = {
    id: createId("trip"),
    name: normalizeText(name) || "Untitled Trip",
    destination: normalizeText(destination) || "TBD",
    startDate: startDate || null,
    endDate: endDate || null,
    organizerId,
    participants: [
      {
        userId: organizerId,
        role: "organizer",
        joinStatus: "approved"
      }
    ],
    budget: null,
    expenses: []
  };

  state.trips.push(trip);
  return hydrateTrip(trip);
}

export function getTripById(tripId) {
  const trip = getTripRecord(tripId);
  return trip ? hydrateTrip(trip) : null;
}

export function getTripRecord(tripId) {
  return state.trips.find((entry) => entry.id === tripId) || null;
}

export function addParticipant(tripId, { userId, role = "participant" }) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const existing = trip.participants.find((entry) => entry.userId === userId);
  if (existing) {
    existing.role = existing.role === "organizer" ? "organizer" : role;
    existing.joinStatus = "approved";
    return hydrateTrip(trip);
  }

  trip.participants.push({
    userId,
    role,
    joinStatus: "approved"
  });

  return hydrateTrip(trip);
}

export function setBudget(tripId, budgetInput) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const mode = budgetInput.mode;
  const totalBudget = budgetInput.totalBudget ?? budgetInput.amount ?? null;
  const perPersonBudget = budgetInput.perPersonBudget ?? budgetInput.amount ?? null;

  trip.budget = {
    mode,
    totalBudget: mode === "total" ? roundCurrency(Number(totalBudget)) : null,
    perPersonBudget:
      mode === "per-person" ? roundCurrency(Number(perPersonBudget)) : null
  };

  return getBudgetSummary(trip);
}

export function addExpense(tripId, expenseInput) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const includedParticipantIds = expenseInput.includedParticipantIds?.length
    ? [...expenseInput.includedParticipantIds]
    : approvedParticipantIds(trip);
  const amount = roundCurrency(Number(expenseInput.amount));
  const expenseShares = createExpenseShares(amount, includedParticipantIds);

  const expense = {
    id: createId("expense"),
    tripId,
    title: normalizeText(expenseInput.title) || "Untitled Expense",
    amount,
    category: expenseInput.category,
    expenseType: expenseInput.expenseType || expenseInput.type,
    payerId: expenseInput.payerId,
    splitRule: expenseInput.splitRule || "equal",
    includedParticipantIds,
    expenseShares,
    createdAt: new Date().toISOString()
  };

  trip.expenses.push(expense);
  return clone(expense);
}

export function deleteExpense(tripId, expenseId) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const index = trip.expenses.findIndex((expense) => expense.id === expenseId);
  if (index === -1) {
    return false;
  }

  const [deletedExpense] = trip.expenses.splice(index, 1);
  return clone(deletedExpense);
}

export function deleteTrip(tripId) {
  const index = state.trips.findIndex((trip) => trip.id === tripId);
  if (index === -1) {
    return null;
  }

  const [deletedTrip] = state.trips.splice(index, 1);
  return hydrateTrip(deletedTrip);
}

export function getExpense(tripId, expenseId) {
  const trip = getTripRecord(tripId);
  const expense = trip?.expenses.find((entry) => entry.id === expenseId);
  return expense ? clone(expense) : null;
}

export function getBudgetSummaryByTripId(tripId) {
  const trip = getTripRecord(tripId);
  return trip ? getBudgetSummary(trip) : null;
}

export function getBalances(tripId, { includeParticipant = false } = {}) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const hydratedTrip = hydrateTrip(trip);
  const balances = calculateBalances({
    participantIds: approvedParticipantIds(trip),
    expenses: trip.expenses
  }).map((entry) => {
    if (!includeParticipant) {
      return entry;
    }

    return {
      ...entry,
      participant: hydratedTrip.participants.find(
        (participant) => participant.id === entry.participantId
      )
    };
  });

  return clone({
    tripId,
    balances
  });
}

export function isApprovedParticipant(tripId, userId) {
  const trip = getTripRecord(tripId);
  return Boolean(
    trip?.participants.some(
      (participant) =>
        participant.userId === userId && participant.joinStatus === "approved"
    )
  );
}

export function isOrganizer(tripId, userId) {
  const trip = getTripRecord(tripId);
  return Boolean(
    trip?.participants.some(
      (participant) =>
        participant.userId === userId &&
        participant.role === "organizer" &&
        participant.joinStatus === "approved"
    )
  );
}

export function approvedParticipantIdsForTrip(tripId) {
  const trip = getTripRecord(tripId);
  return trip ? approvedParticipantIds(trip) : [];
}

export function isValidBudgetInput(input) {
  if (!BUDGET_MODES.includes(input.mode)) {
    return false;
  }

  if (input.mode === "total") {
    return Number(input.totalBudget ?? input.amount) > 0;
  }

  return Number(input.perPersonBudget ?? input.amount) > 0;
}

export function isValidExpenseInput(input) {
  const category = input.category;
  const expenseType = input.expenseType || input.type;
  const splitRule = input.splitRule || "equal";

  return (
    Number(input.amount) > 0 &&
    EXPENSE_CATEGORIES.includes(category) &&
    EXPENSE_TYPES.includes(expenseType) &&
    SPLIT_RULES.includes(splitRule)
  );
}

function summarizeTrip(trip) {
  return clone({
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    organizerId: trip.organizerId,
    participantCount: approvedParticipantIds(trip).length,
    expenseCount: trip.expenses.length,
    budgetSummary: getBudgetSummary(trip)
  });
}

function hydrateTrip(trip) {
  const participants = trip.participants
    .map((participant) => {
      const user = state.users.find((entry) => entry.id === participant.userId);
      if (!user) {
        return null;
      }

      return {
        ...toSafeUser(user),
        role: participant.role,
        joinStatus: participant.joinStatus
      };
    })
    .filter(Boolean);

  return clone({
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    organizerId: trip.organizerId,
    participantIds: participants.map((participant) => participant.id),
    participants,
    budgetSummary: getBudgetSummary(trip),
    expenses: trip.expenses
  });
}

function getBudgetSummary(trip) {
  if (!trip.budget) {
    return null;
  }

  const participantCount = approvedParticipantIds(trip).length;
  const totalSpent = roundCurrency(
    trip.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  );
  const totalBudget =
    trip.budget.mode === "per-person"
      ? roundCurrency(trip.budget.perPersonBudget * participantCount)
      : trip.budget.totalBudget;
  const remainingBudget = roundCurrency(Math.max(totalBudget - totalSpent, 0));
  const overBudgetAmount = roundCurrency(Math.max(totalSpent - totalBudget, 0));

  return clone({
    mode: trip.budget.mode,
    totalBudget,
    perPersonBudget: trip.budget.perPersonBudget,
    participantCount,
    totalSpent,
    remainingBudget,
    overBudgetAmount
  });
}

function createExpenseShares(amount, includedParticipantIds) {
  const splitCount = includedParticipantIds.length || 1;
  const shareAmount = roundCurrency(amount / splitCount);

  return includedParticipantIds.map((participantId) => ({
    participantId,
    shareAmount
  }));
}

function approvedParticipantIds(trip) {
  return trip.participants
    .filter((participant) => participant.joinStatus === "approved")
    .map((participant) => participant.userId);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toSafeUser(user) {
  return {
    id: user.id,
    userId: user.name,
    name: user.name,
    displayName: user.displayName || user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || ""
  };
}

function createId(prefix) {
  const id = `${prefix}_${state.nextId}`;
  state.nextId += 1;
  return id;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}
