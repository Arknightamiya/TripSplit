import {
  BUDGET_MODES,
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES,
  SPLIT_RULES
} from "../shared/contracts.js";
import { calculateBalances } from "./settlement.js";
import {
  DEFAULT_CURRENCY_CODE,
  normalizeCurrencyCode,
  splitCurrencyEvenly
} from "./utils/currency.js";

const state = {
  nextId: 1,
  users: [],
  trips: [],
  friendRequests: [],
  friendships: [],
  tripJoinRequests: []
};

export function resetStore() {
  state.nextId = 1;
  state.users = [];
  state.trips = [];
  state.friendRequests = [];
  state.friendships = [];
  state.tripJoinRequests = [];
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
    (entry) => !(entry.userId === userId && entry.friendId === friendId)
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
    totalBudget: mode === "total" ? roundCurrency(Number(totalBudget)) : null,
    perPersonBudget:
      mode === "per-person" ? roundCurrency(Number(perPersonBudget)) : null,
    currencyCode: normalizeCurrencyCode(budgetInput.currencyCode)
  };

  return getBudgetSummary(trip);
}

export function addExpense(tripId, expenseInput) {
  const trip = getTripRecord(tripId);
  if (!trip) {
    return null;
  }

  const expenseType = expenseInput.expenseType || expenseInput.type;
  const includedParticipantIds = expenseType === "personal_advance"
    ? [expenseInput.payerId]
    : expenseInput.includedParticipantIds?.length
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
    expenseType,
    currencyCode: normalizeCurrencyCode(expenseInput.currencyCode),
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
    visibility: trip.visibility || "private",
    organizerId: trip.organizerId,
    participantIds: participants
      .filter((participant) => participant.joinStatus === "approved")
      .map((participant) => participant.id),
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
    currencyCode: trip.budget.currencyCode || DEFAULT_CURRENCY_CODE,
    participantCount,
    totalSpent,
    remainingBudget,
    overBudgetAmount
  });
}

function createExpenseShares(amount, includedParticipantIds) {
  return splitCurrencyEvenly(amount, includedParticipantIds);
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
