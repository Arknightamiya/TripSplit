import {
  BUDGET_MODES,
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES,
  SPLIT_RULES
} from "../shared/contracts.js";
import { calculateBalances } from "./settlement.js";
import {
  isValidCurrencyAmount,
  normalizeCurrencyAmount,
  splitCurrencyEvenly
} from "./utils/currency.js";

const state = {
  nextId: 1,
  users: [],
  pendingRegistrations: [],
  trips: [],
  friendRequests: [],
  friendships: [],
  tripJoinRequests: [],
  auditLogs: []
};

export function resetStore() {
  state.nextId = 1;
  state.users = [];
  state.pendingRegistrations = [];
  state.trips = [];
  state.friendRequests = [];
  state.friendships = [];
  state.tripJoinRequests = [];
  state.auditLogs = [];
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

export function upsertPendingRegistration({
  email,
  name,
  passwordHash,
  verificationCodeHash,
  expiresAt,
  resendAvailableAt
}) {
  const normalizedEmail = normalizeEmail(email);
  const existing = state.pendingRegistrations.find((entry) => entry.email === normalizedEmail);
  const now = new Date().toISOString();

  if (existing) {
    existing.name = normalizeText(name);
    existing.passwordHash = passwordHash;
    existing.verificationCodeHash = verificationCodeHash;
    existing.expiresAt = expiresAt;
    existing.resendAvailableAt = resendAvailableAt;
    existing.attemptCount = 0;
    existing.updatedAt = now;
    return clone(existing);
  }

  const pendingRegistration = {
    id: createId("pending_registration"),
    email: normalizedEmail,
    name: normalizeText(name),
    passwordHash,
    verificationCodeHash,
    expiresAt,
    resendAvailableAt,
    attemptCount: 0,
    createdAt: now,
    updatedAt: now
  };

  state.pendingRegistrations.push(pendingRegistration);
  return clone(pendingRegistration);
}

export function findPendingRegistrationByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const pendingRegistration = state.pendingRegistrations.find(
    (entry) => entry.email === normalizedEmail
  );
  return pendingRegistration ? clone(pendingRegistration) : null;
}

export function updatePendingRegistration(email, updates = {}) {
  const normalizedEmail = normalizeEmail(email);
  const pendingRegistration = state.pendingRegistrations.find(
    (entry) => entry.email === normalizedEmail
  );

  if (!pendingRegistration) {
    return null;
  }

  Object.assign(pendingRegistration, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
  return clone(pendingRegistration);
}

export function deletePendingRegistration(email) {
  const normalizedEmail = normalizeEmail(email);
  const beforeCount = state.pendingRegistrations.length;
  state.pendingRegistrations = state.pendingRegistrations.filter(
    (entry) => entry.email !== normalizedEmail
  );
  return state.pendingRegistrations.length !== beforeCount;
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

export function createTrip({
  name,
  destination,
  startDate,
  endDate,
  visibility,
  organizerId,
  invitedParticipantIds = []
}) {
  const trip = {
    id: createId("trip"),
    name: normalizeText(name) || "Untitled Trip",
    destination: normalizeText(destination) || "TBD",
    startDate: startDate || null,
    endDate: endDate || null,
    visibility: inputVisibility(visibility),
    organizerId,
    startedAt: null,
    endedAt: null,
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

  for (const invitedParticipantId of invitedParticipantIds) {
    trip.participants.push({
      userId: invitedParticipantId,
      role: "participant",
      joinStatus: "pending"
    });
  }

  state.trips.push(trip);
  return hydrateTrip(trip);
}

export function listFriendsForUser(userId) {
  return state.friendships
    .filter((entry) => entry.userId === userId)
    .map((entry) => findUserById(entry.friendId))
    .filter(Boolean)
    .map(toSafeFriend);
}

export function areFriends(userId, friendId) {
  return state.friendships.some(
    (entry) => entry.userId === userId && entry.friendId === friendId
  );
}

export function searchUsers(query, viewerId) {
  const normalizedQuery = normalizeText(query).toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return state.users
    .filter((user) => user.id !== viewerId)
    .filter((user) =>
      [user.name, user.displayName, user.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    )
    .slice(0, 8)
    .map((user) => ({
      ...toSafeFriend(user),
      relationship: getRelationship(viewerId, user.id)
    }));
}

export function createFriendRequest({ requesterId, recipientId }) {
  const request = {
    id: createId("friend_request"),
    requesterId,
    recipientId,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  state.friendRequests.push(request);
  return hydrateFriendRequest(request);
}

export function listIncomingFriendRequests(userId) {
  return state.friendRequests
    .filter((request) => request.recipientId === userId && request.status === "pending")
    .map(hydrateFriendRequest)
    .filter(Boolean);
}

export function listOutgoingFriendRequests(userId) {
  return state.friendRequests
    .filter((request) => request.requesterId === userId && request.status === "pending")
    .map(hydrateFriendRequest)
    .filter(Boolean);
}

export function findPendingFriendRequestBetween(userAId, userBId) {
  return state.friendRequests.find(
    (request) =>
      request.status === "pending" &&
      ((request.requesterId === userAId && request.recipientId === userBId) ||
        (request.requesterId === userBId && request.recipientId === userAId))
  ) || null;
}

export function respondToFriendRequest(requestId, recipientId, status) {
  const request = state.friendRequests.find(
    (entry) => entry.id === requestId && entry.recipientId === recipientId
  );

  if (!request || request.status !== "pending") {
    return null;
  }

  request.status = status;

  if (status === "accepted") {
    addFriendshipPair(request.requesterId, request.recipientId);
  }

  return hydrateFriendRequest(request);
}

export function removeFriendship(userId, friendId) {
  const beforeCount = state.friendships.length;
  state.friendships = state.friendships.filter(
    (entry) =>
      !(
        (entry.userId === userId && entry.friendId === friendId) ||
        (entry.userId === friendId && entry.friendId === userId)
      )
  );
  return state.friendships.length !== beforeCount;
}

export function listPublicTripsForFriend(viewerId, friendId) {
  if (!areFriends(viewerId, friendId) || !areFriends(friendId, viewerId)) {
    return [];
  }

  return state.trips
    .filter((trip) => trip.organizerId === friendId && trip.visibility === "public")
    .map((trip) => ({
      ...summarizeTrip(trip),
      joinRequestStatus: getTripJoinRequestStatus(trip.id, viewerId),
      invitationStatus: getTripInvitationStatus(trip.id, viewerId),
      isParticipant: isApprovedParticipant(trip.id, viewerId)
    }));
}

export function createTripJoinRequest({ tripId, requesterId }) {
  const request = {
    id: createId("trip_join_request"),
    tripId,
    requesterId,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  state.tripJoinRequests.push(request);
  return hydrateTripJoinRequest(request);
}

export function findPendingTripJoinRequest(tripId, requesterId) {
  return state.tripJoinRequests.find(
    (request) =>
      request.tripId === tripId &&
      request.requesterId === requesterId &&
      request.status === "pending"
  ) || null;
}

export function listIncomingTripJoinRequests(organizerId) {
  return state.tripJoinRequests
    .filter((request) => {
      const trip = getTripRecord(request.tripId);
      return (
        request.status === "pending" &&
        trip?.organizerId === organizerId
      );
    })
    .map(hydrateTripJoinRequest)
    .filter(Boolean);
}

export function respondToTripJoinRequest(requestId, organizerId, status) {
  const request = state.tripJoinRequests.find((entry) => entry.id === requestId);
  const trip = request ? getTripRecord(request.tripId) : null;

  if (!request || !trip || trip.organizerId !== organizerId || request.status !== "pending") {
    return null;
  }

  request.status = status;

  if (status === "accepted") {
    addParticipant(request.tripId, {
      userId: request.requesterId,
      role: "participant"
    });
  }

  return hydrateTripJoinRequest(request);
}

export function listIncomingTripInvitations(userId) {
  return state.trips
    .flatMap((trip) =>
      trip.participants
        .filter(
          (participant) =>
            participant.userId === userId && participant.joinStatus === "pending"
        )
        .map((participant) => ({ trip, participant }))
    )
    .map(({ trip, participant }) => hydrateTripInvitation(trip, participant, "pending"))
    .filter(Boolean);
}

export function respondToTripInvitation(tripId, userId, status) {
  const trip = getTripRecord(tripId);
  const participant = trip?.participants.find(
    (entry) => entry.userId === userId && entry.joinStatus === "pending"
  );

  if (!trip || !participant) {
    return null;
  }

  if (status === "accepted") {
    participant.joinStatus = "approved";
  } else {
    trip.participants = trip.participants.filter(
      (entry) => !(entry.userId === userId && entry.joinStatus === "pending")
    );
  }

  return hydrateTripInvitation(trip, participant, status);
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

export function inviteParticipant(tripId, { userId, role = "participant" }) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const existing = trip.participants.find((entry) => entry.userId === userId);
  if (existing) {
    if (existing.joinStatus !== "approved") {
      existing.role = existing.role === "organizer" ? "organizer" : role;
      existing.joinStatus = "pending";
    }
    return hydrateTrip(trip);
  }

  trip.participants.push({
    userId,
    role,
    joinStatus: "pending"
  });

  return hydrateTrip(trip);
}

export function removeTripParticipant(tripId, userId) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const existing = trip.participants.find((entry) => entry.userId === userId);
  if (!existing) {
    return null;
  }

  trip.participants = trip.participants.filter((entry) => entry.userId !== userId);
  for (const expense of trip.expenses) {
    expense.includedParticipantIds = expense.includedParticipantIds.filter(
      (participantId) => participantId !== userId
    );
    expense.expenseShares = expense.expenseShares.filter(
      (share) => share.participantId !== userId
    );
  }

  return hydrateTrip(trip);
}

export function startTrip(tripId) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  if (!trip.startedAt) {
    trip.startedAt = new Date().toISOString();
  }

  return hydrateTrip(trip);
}

export function endTrip(tripId) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  if (!trip.endedAt) {
    trip.endedAt = new Date().toISOString();
  }

  return hydrateTrip(trip);
}

export function findTripParticipant(tripId, userId) {
  const trip = getTripRecord(tripId);
  const participant = trip?.participants.find((entry) => entry.userId === userId);
  return participant ? clone(participant) : null;
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
    totalBudget: mode === "total" ? normalizeCurrencyAmount(totalBudget) : null,
    perPersonBudget:
      mode === "per-person" ? normalizeCurrencyAmount(perPersonBudget) : null
  };

  return getBudgetSummary(trip);
}

export function addExpense(tripId, expenseInput) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const expenseType = normalizeExpenseType(expenseInput.expenseType || expenseInput.type);
  const includedParticipantIds = expenseInput.includedParticipantIds?.length
    ? uniqueStrings(expenseInput.includedParticipantIds)
    : [];
  const amount = normalizeCurrencyAmount(expenseInput.amount);
  const expenseShares = createExpenseShares(
    amount,
    expenseType,
    expenseInput.payerId,
    includedParticipantIds
  );

  const expense = {
    id: createId("expense"),
    tripId,
    title: normalizeText(expenseInput.title) || "Untitled Expense",
    amount,
    category: expenseInput.category,
    expenseType,
    payerId: expenseInput.payerId,
    splitRule: expenseInput.splitRule || "equal",
    includedParticipantIds,
    expenseShares,
    createdAt: new Date().toISOString(),
    deletedAt: null,
    deletedBy: null
  };

  trip.expenses.push(expense);
  createAuditLog({
    tripId,
    actorId: expenseInput.actorId || expenseInput.payerId,
    action: "expense.created",
    targetType: "expense",
    targetId: expense.id
  });
  return clone(expense);
}

export function deleteExpense(tripId, expenseId, actorId) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const expense = trip.expenses.find((entry) => entry.id === expenseId);
  if (!expense || expense.deletedAt) {
    return false;
  }

  expense.deletedAt = new Date().toISOString();
  expense.deletedBy = actorId || null;
  createAuditLog({
    tripId,
    actorId,
    action: "expense.deleted",
    targetType: "expense",
    targetId: expense.id
  });
  return clone(expense);
}

export function restoreExpense(tripId, expenseId, actorId) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const expense = trip.expenses.find((entry) => entry.id === expenseId);
  if (!expense || !expense.deletedAt) {
    return false;
  }

  expense.deletedAt = null;
  expense.deletedBy = null;
  createAuditLog({
    tripId,
    actorId,
    action: "expense.restored",
    targetType: "expense",
    targetId: expense.id
  });
  return clone(expense);
}

export function deleteTrip(tripId) {
  const index = state.trips.findIndex((trip) => trip.id === tripId);
  if (index === -1) {
    return null;
  }

  const [deletedTrip] = state.trips.splice(index, 1);
  return hydrateTrip(deletedTrip);
}

export function updateTrip(tripId, input = {}) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  if (input.name !== undefined) {
    trip.name = normalizeText(input.name) || trip.name;
  }

  if (input.destination !== undefined) {
    trip.destination = normalizeText(input.destination) || "TBD";
  }

  if (input.startDate !== undefined) {
    trip.startDate = input.startDate || null;
  }

  if (input.endDate !== undefined) {
    trip.endDate = input.endDate || null;
  }

  if (input.visibility !== undefined) {
    trip.visibility = inputVisibility(input.visibility);
  }

  return hydrateTrip(trip);
}

export function getExpense(tripId, expenseId) {
  const trip = getTripRecord(tripId);
  const expense = trip?.expenses.find((entry) => entry.id === expenseId);
  return expense ? clone(expense) : null;
}

export function listAuditLogsForTrip(tripId) {
  return clone(
    state.auditLogs.filter((entry) => String(entry.tripId) === String(tripId))
  );
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
  const activeExpenses = activeTripExpenses(trip);
  const balances = calculateBalances({
    participantIds: approvedParticipantIds(trip),
    expenses: activeExpenses
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
    return isValidCurrencyAmount(input.totalBudget ?? input.amount);
  }

  return isValidCurrencyAmount(input.perPersonBudget ?? input.amount);
}

export function isValidExpenseInput(input) {
  const category = input.category;
  const expenseType = normalizeExpenseType(input.expenseType || input.type);
  const splitRule = input.splitRule || "equal";

  return (
    isValidCurrencyAmount(input.amount) &&
    EXPENSE_CATEGORIES.includes(category) &&
    EXPENSE_TYPES.includes(expenseType) &&
    SPLIT_RULES.includes(splitRule)
  );
}

function summarizeTrip(trip) {
  const organizer = findUserById(trip.organizerId);

  return clone({
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    visibility: trip.visibility || "private",
    organizerId: trip.organizerId,
    organizerName: organizer?.displayName || organizer?.name || "Organizer",
    organizer: organizer ? toSafeFriend(organizer) : null,
    startedAt: trip.startedAt || null,
    endedAt: trip.endedAt || null,
    participantCount: approvedParticipantIds(trip).length,
    expenseCount: activeTripExpenses(trip).length,
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
    visibility: trip.visibility || "private",
    organizerId: trip.organizerId,
    startedAt: trip.startedAt || null,
    endedAt: trip.endedAt || null,
    participantIds: participants
      .filter((participant) => participant.joinStatus === "approved")
      .map((participant) => participant.id),
    participants,
    budgetSummary: getBudgetSummary(trip),
    expenses: activeTripExpenses(trip),
    deletedExpenses: deletedTripExpenses(trip),
    auditLogs: state.auditLogs.filter((entry) => String(entry.tripId) === String(trip.id))
  });
}

function getBudgetSummary(trip) {
  if (!trip.budget) {
    return null;
  }

  const participantCount = approvedParticipantIds(trip).length;
  const totalSpent = roundCurrency(
    activeTripExpenses(trip)
      .filter((expense) => normalizeExpenseType(expense.expenseType) === "budget_payment")
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
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

function createExpenseShares(amount, expenseType, payerId, includedParticipantIds) {
  if (normalizeExpenseType(expenseType) === "personal_advance") {
    return createPersonalAdvanceShares(amount, payerId, includedParticipantIds);
  }

  const participantIds = includedParticipantIds.length ? includedParticipantIds : [payerId];
  return splitCurrencyEvenly(amount, participantIds);
}

function activeTripExpenses(trip) {
  return (trip.expenses || []).filter((expense) => !expense.deletedAt);
}

function deletedTripExpenses(trip) {
  return (trip.expenses || []).filter((expense) => expense.deletedAt);
}

function createAuditLog({ tripId, actorId, action, targetType, targetId }) {
  const entry = {
    id: createId("audit"),
    tripId: String(tripId),
    actorId: actorId ? String(actorId) : null,
    action,
    targetType,
    targetId: targetId ? String(targetId) : null,
    createdAt: new Date().toISOString()
  };
  state.auditLogs.push(entry);
  return clone(entry);
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

function normalizeExpenseType(expenseType) {
  return expenseType === "shared" ? "personal_advance" : expenseType;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(String)));
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

function toSafeFriend(user) {
  return {
    id: user.id,
    userId: user.name,
    name: user.name,
    displayName: user.displayName || user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || ""
  };
}

function hydrateFriendRequest(request) {
  const requester = findUserById(request.requesterId);
  const recipient = findUserById(request.recipientId);

  if (!requester || !recipient) {
    return null;
  }

  return clone({
    id: request.id,
    status: request.status,
    requester: toSafeFriend(requester),
    recipient: toSafeFriend(recipient),
    createdAt: request.createdAt
  });
}

function hydrateTripJoinRequest(request) {
  const trip = getTripRecord(request.tripId);
  const requester = findUserById(request.requesterId);

  if (!trip || !requester) {
    return null;
  }

  return clone({
    id: request.id,
    status: request.status,
    trip: summarizeTrip(trip),
    requester: toSafeFriend(requester),
    createdAt: request.createdAt
  });
}

function hydrateTripInvitation(trip, participant, status) {
  const organizer = findUserById(trip.organizerId);
  const invitee = findUserById(participant.userId);

  if (!organizer || !invitee) {
    return null;
  }

  return clone({
    id: trip.id,
    tripId: trip.id,
    status,
    trip: summarizeTrip(trip),
    organizer: toSafeFriend(organizer),
    invitee: toSafeFriend(invitee),
    createdAt: new Date().toISOString()
  });
}

function addFriendshipPair(userAId, userBId) {
  if (!areFriends(userAId, userBId)) {
    state.friendships.push({ userId: userAId, friendId: userBId });
  }

  if (!areFriends(userBId, userAId)) {
    state.friendships.push({ userId: userBId, friendId: userAId });
  }
}

function getRelationship(viewerId, userId) {
  if (areFriends(viewerId, userId)) {
    return "friend";
  }

  const pending = findPendingFriendRequestBetween(viewerId, userId);
  if (!pending) {
    return "none";
  }

  return pending.requesterId === viewerId ? "outgoing_pending" : "incoming_pending";
}

function getTripJoinRequestStatus(tripId, requesterId) {
  const request = state.tripJoinRequests.find(
    (entry) => entry.tripId === tripId && entry.requesterId === requesterId
  );
  return request?.status || "none";
}

function getTripInvitationStatus(tripId, userId) {
  const trip = getTripRecord(tripId);
  const invitation = trip?.participants.find(
    (entry) => entry.userId === userId && entry.joinStatus === "pending"
  );
  return invitation ? "pending" : "none";
}

function inputVisibility(value) {
  return value === "public" ? "public" : "private";
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
