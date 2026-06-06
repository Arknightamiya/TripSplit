import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createApp } from "../server/app.js";
import { resetStore } from "../server/store.js";
import {
  assertBalances,
  assertBudget,
  assertNetBalancesConserved,
  authHeaders,
  createRequest,
  loginOrRegisterUser as loginOrRegisterTestUser,
  registerUser as registerTestUser,
  sendAndAcceptFriendRequest as sendAndAcceptFriendRequestWithRequest
} from "./helpers/api.js";

let app;
const request = createRequest(() => app);

beforeEach(() => {
  resetStore();
  app = createApp();
});

test("real-world UCLA smoke flow covers invitations, budget, expenses, and balances", async () => {
  const { dw1, dw2, gogo } = await registerCoreUsers();

  const publicTripResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      name: "UCLA Los Angeles",
      destination: "UCLA Los Angeles",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      visibility: "public",
      inviteeUserIds: [dw2.user.id]
    }
  });
  const privateTripResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      name: "Private Planning Trip",
      destination: "Secret Destination",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      visibility: "private"
    }
  });
  const tripId = publicTripResponse.body.trip.id;
  const privateTripId = privateTripResponse.body.trip.id;

  assert.equal(publicTripResponse.status, 201);
  assert.equal(publicTripResponse.body.trip.organizerId, dw1.user.id);
  assert.equal(publicTripResponse.body.trip.participantCount, undefined);
  assert.equal(publicTripResponse.body.trip.participants.length, 2);
  assert.equal(
    publicTripResponse.body.trip.participants.find((participant) => participant.id === dw2.user.id)
      .joinStatus,
    "pending"
  );

  const dw2PendingTrip = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(dw2.token)
  });
  const dw2OverviewBeforeAccept = await request("/api/friends", {
    headers: authHeaders(dw2.token)
  });
  const gogoLobbyBeforeFriendship = await request("/api/friends/public-trips", {
    headers: authHeaders(gogo.token)
  });
  const gogoJoinBeforeFriendship = await request(`/api/friends/trips/${tripId}/join-requests`, {
    method: "POST",
    headers: authHeaders(gogo.token)
  });
  const gogoPrivateTripBeforeJoin = await request(`/api/trips/${privateTripId}`, {
    headers: authHeaders(gogo.token)
  });

  assert.equal(dw2PendingTrip.status, 403);
  assert.equal(dw2OverviewBeforeAccept.body.tripInvitations.length, 1);
  assert.equal(gogoLobbyBeforeFriendship.status, 200);
  assert.deepEqual(gogoLobbyBeforeFriendship.body.publicTrips, []);
  assert.equal(gogoJoinBeforeFriendship.status, 403);
  assert.deepEqual(gogoJoinBeforeFriendship.body, {
    error: "Only friends can request to join this trip"
  });
  assert.equal(gogoPrivateTripBeforeJoin.status, 403);

  const dw2AcceptInvite = await request(`/api/friends/trip-invitations/${tripId}/accept`, {
    method: "POST",
    headers: authHeaders(dw2.token)
  });
  const dw2TripAfterAccept = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(dw2.token)
  });

  assert.equal(dw2AcceptInvite.status, 200);
  assert.equal(dw2AcceptInvite.body.invitation.status, "accepted");
  assert.equal(dw2TripAfterAccept.status, 200);
  assert.deepEqual(
    dw2TripAfterAccept.body.trip.participantIds.sort(),
    [dw1.user.id, dw2.user.id].sort()
  );

  await sendAndAcceptFriendRequest({
    requester: gogo,
    recipient: dw1
  });

  const gogoLobbyAfterFriendship = await request("/api/friends/public-trips", {
    headers: authHeaders(gogo.token)
  });
  const gogoJoinAfterFriendship = await request(`/api/friends/trips/${tripId}/join-requests`, {
    method: "POST",
    headers: authHeaders(gogo.token)
  });
  const dw1OverviewWithJoinRequest = await request("/api/friends", {
    headers: authHeaders(dw1.token)
  });
  const acceptGogoJoin = await request(
    `/api/friends/trip-join-requests/${dw1OverviewWithJoinRequest.body.tripJoinRequests[0].id}/accept`,
    {
      method: "POST",
      headers: authHeaders(dw1.token)
    }
  );
  const tripAfterGogoJoin = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(gogo.token)
  });

  assert.equal(gogoLobbyAfterFriendship.status, 200);
  assert.equal(gogoLobbyAfterFriendship.body.publicTrips.length, 1);
  assert.equal(gogoLobbyAfterFriendship.body.publicTrips[0].id, tripId);
  assert.equal(gogoJoinAfterFriendship.status, 201);
  assert.equal(dw1OverviewWithJoinRequest.body.tripJoinRequests.length, 1);
  assert.equal(acceptGogoJoin.status, 200);
  assert.equal(acceptGogoJoin.body.request.status, "accepted");
  assert.equal(tripAfterGogoJoin.status, 200);
  assert.deepEqual(
    tripAfterGogoJoin.body.trip.participantIds.sort(),
    [dw1.user.id, dw2.user.id, gogo.user.id].sort()
  );

  const participantBudgetAttempt = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(dw2.token),
    body: {
      mode: "total",
      totalBudget: 500
    }
  });
  const initialBudget = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      mode: "total",
      totalBudget: 300
    }
  });
  const startTrip = await request(`/api/trips/${tripId}/start`, {
    method: "POST",
    headers: authHeaders(dw1.token)
  });
  const dinner = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      title: "Korean BBQ Dinner",
      amount: 180,
      category: "food",
      expenseType: "budget_payment",
      payerId: dw1.user.id,
      splitRule: "equal",
      includedParticipantIds: [dw1.user.id, dw2.user.id, gogo.user.id]
    }
  });

  assert.equal(participantBudgetAttempt.status, 403);
  assert.deepEqual(participantBudgetAttempt.body, {
    error: "Only an organizer can perform this action"
  });
  assert.equal(initialBudget.status, 200);
  assert.equal(initialBudget.body.budgetSummary.totalBudget, 300);
  assert.equal(initialBudget.body.budgetSummary.participantCount, 3);
  assert.equal(startTrip.status, 200);
  assert.equal(typeof startTrip.body.trip.startedAt, "string");
  assert.equal(dinner.status, 201);
  assert.deepEqual(dinner.body.expense.expenseShares, [
    {
      participantId: dw1.user.id,
      shareAmount: 60
    },
    {
      participantId: dw2.user.id,
      shareAmount: 60
    },
    {
      participantId: gogo.user.id,
      shareAmount: 60
    }
  ]);
  assertBudget(dinner.body.budgetSummary, {
    totalBudget: 300,
    totalSpent: 180,
    remainingBudget: 120,
    overBudgetAmount: 0
  });
  assertBalances(dinner.body.balances, [
    {
      participantId: dw1.user.id,
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    },
    {
      participantId: dw2.user.id,
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    },
    {
      participantId: gogo.user.id,
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    }
  ]);

  const hotel = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      title: "UCLA Hotel",
      amount: 450,
      category: "lodging",
      expenseType: "budget_payment",
      payerId: dw1.user.id,
      splitRule: "equal",
      includedParticipantIds: [dw1.user.id, dw2.user.id, gogo.user.id]
    }
  });
  const tickets = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(dw2.token),
    body: {
      title: "Museum Tickets",
      amount: 99,
      category: "tickets",
      expenseType: "personal_advance",
      payerId: dw2.user.id,
      splitRule: "equal",
      includedParticipantIds: [dw1.user.id, dw2.user.id, gogo.user.id]
    }
  });
  const personalDrink = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(gogo.token),
    body: {
      title: "Personal Drink",
      amount: 45,
      category: "drinks",
      expenseType: "personal_advance",
      payerId: gogo.user.id,
      splitRule: "equal",
      includedParticipantIds: [gogo.user.id]
    }
  });

  assert.equal(hotel.status, 201);
  assert.equal(tickets.status, 201);
  assert.deepEqual(tickets.body.expense.expenseShares, [
    {
      participantId: dw1.user.id,
      shareAmount: 33
    },
    {
      participantId: gogo.user.id,
      shareAmount: 33
    }
  ]);
  assert.equal(personalDrink.status, 400);
  assert.deepEqual(personalDrink.body, {
    error: "Choose at least one person who should reimburse the payer"
  });

  const lunch = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(dw2.token),
    body: {
      title: "Ackerman Lunch",
      amount: 75,
      category: "food",
      expenseType: "personal_advance",
      payerId: dw2.user.id,
      splitRule: "equal",
      includedParticipantIds: [dw1.user.id, dw2.user.id]
    }
  });

  assert.equal(lunch.status, 201);
  assert.deepEqual(lunch.body.expense.expenseShares, [
    {
      participantId: dw1.user.id,
      shareAmount: 37.5
    }
  ]);
  assertBudget(lunch.body.budgetSummary, {
    totalBudget: 300,
    totalSpent: 630,
    remainingBudget: 0,
    overBudgetAmount: 330
  });
  assertBalances(lunch.body.balances, [
    {
      participantId: dw1.user.id,
      actualPaid: 0,
      fairShare: 70.5,
      netBalance: -70.5
    },
    {
      participantId: dw2.user.id,
      actualPaid: 174,
      fairShare: 70.5,
      netBalance: 103.5
    },
    {
      participantId: gogo.user.id,
      actualPaid: 0,
      fairShare: 33,
      netBalance: -33
    }
  ]);
  assertNetBalancesConserved(lunch.body.balances);

  const dw2DeleteOrganizerExpense = await request(
    `/api/trips/${tripId}/expenses/${hotel.body.expense.id}`,
    {
      method: "DELETE",
      headers: authHeaders(dw2.token)
    }
  );
  const dw2DeleteOwnLunch = await request(`/api/trips/${tripId}/expenses/${lunch.body.expense.id}`, {
    method: "DELETE",
    headers: authHeaders(dw2.token)
  });

  assert.equal(dw2DeleteOrganizerExpense.status, 403);
  assert.deepEqual(dw2DeleteOrganizerExpense.body, {
    error: "Only the expense payer or trip organizer can delete this expense"
  });
  assert.equal(dw2DeleteOwnLunch.status, 200);
  assert.equal(dw2DeleteOwnLunch.body.deletedExpenseId, lunch.body.expense.id);
  assertNetBalancesConserved(dw2DeleteOwnLunch.body.balances);
});

test("extra registered outsider is blocked from private data and invalid expense roles", async () => {
  const { dw1, dw2 } = await registerCoreUsers();
  const outsider = await registerUser({
    name: "outsider",
    email: "outsider@example.com",
    password: "Outsider-password1!"
  });

  const tripResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      name: "Private Dinner Planning",
      visibility: "private"
    }
  });
  const tripId = tripResponse.body.trip.id;
  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      userId: dw2.user.id
    }
  });
  await request(`/api/trips/${tripId}/start`, {
    method: "POST",
    headers: authHeaders(dw1.token)
  });

  const outsiderTripAccess = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(outsider.token)
  });
  const outsiderJoinPrivate = await request(`/api/friends/trips/${tripId}/join-requests`, {
    method: "POST",
    headers: authHeaders(outsider.token)
  });
  const outsiderAsPayer = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      title: "Blocked Outsider Payer",
      amount: 24,
      category: "food",
      expenseType: "personal_advance",
      payerId: outsider.user.id,
      splitRule: "equal",
      includedParticipantIds: [dw1.user.id, dw2.user.id]
    }
  });
  const outsiderAsSplitParticipant = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      title: "Blocked Outsider Split",
      amount: 24,
      category: "food",
      expenseType: "personal_advance",
      payerId: dw1.user.id,
      splitRule: "equal",
      includedParticipantIds: [dw1.user.id, outsider.user.id]
    }
  });

  assert.match(outsider.user.userId, /^outsider#\d+$/);
  assert.equal(outsiderTripAccess.status, 403);
  assert.equal(outsiderJoinPrivate.status, 403);
  assert.deepEqual(outsiderJoinPrivate.body, {
    error: "This trip is private"
  });
  assert.equal(outsiderAsPayer.status, 400);
  assert.deepEqual(outsiderAsPayer.body, {
    error: "Expense payer must be an approved trip participant"
  });
  assert.equal(outsiderAsSplitParticipant.status, 400);
  assert.deepEqual(outsiderAsSplitParticipant.body, {
    error: "Expense split participant must be an approved trip participant"
  });
});

test("participant can record and delete their own trip expense", async () => {
  const { dw1, dw2 } = await registerCoreUsers();
  const tripResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      name: "Participant Permission Dinner",
      visibility: "private"
    }
  });
  const tripId = tripResponse.body.trip.id;
  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      userId: dw2.user.id
    }
  });
  await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      mode: "total",
      totalBudget: 500
    }
  });
  await request(`/api/trips/${tripId}/start`, {
    method: "POST",
    headers: authHeaders(dw1.token)
  });

  const participantExpense = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(dw2.token),
    body: {
      title: "Participant Lunch",
      amount: 75,
      category: "food",
      expenseType: "personal_advance",
      payerId: dw2.user.id,
      splitRule: "equal",
      includedParticipantIds: [dw1.user.id, dw2.user.id]
    }
  });
  const balances = await request(`/api/trips/${tripId}/balances`, {
    headers: authHeaders(dw2.token)
  });
  const deleteOwnExpense = await request(
    `/api/trips/${tripId}/expenses/${participantExpense.body.expense.id}`,
    {
      method: "DELETE",
      headers: authHeaders(dw2.token)
    }
  );

  assert.equal(participantExpense.status, 201);
  assert.deepEqual(participantExpense.body.expense.expenseShares, [
    {
      participantId: dw1.user.id,
      shareAmount: 37.5
    }
  ]);
  assert.equal(balances.status, 200);
  assertBalances(balances.body.balances, [
    {
      participantId: dw1.user.id,
      actualPaid: 0,
      fairShare: 37.5,
      netBalance: -37.5
    },
    {
      participantId: dw2.user.id,
      actualPaid: 75,
      fairShare: 37.5,
      netBalance: 37.5
    }
  ]);
  assert.equal(deleteOwnExpense.status, 200);
  assert.equal(deleteOwnExpense.body.deletedExpenseId, participantExpense.body.expense.id);
  assertBalances(deleteOwnExpense.body.balances, [
    {
      participantId: dw1.user.id,
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    },
    {
      participantId: dw2.user.id,
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    }
  ]);
});

async function registerCoreUsers() {
  const dw1 = await loginOrRegisterUser({
    identifier: "dw#1",
    name: "dw",
    email: "dw-one@example.com",
    password: "Dw-One_123"
  });
  const dw2 = await loginOrRegisterUser({
    identifier: "dw#2",
    name: "dw",
    email: "dw-two@example.com",
    password: "Dw-Two_123"
  });
  const gogo = await loginOrRegisterUser({
    identifier: "gogo#1",
    name: "gogo",
    email: "gogo@example.com",
    password: "Go-Go_123"
  });

  assert.equal(dw1.user.userId, "dw#1");
  assert.equal(dw2.user.userId, "dw#2");
  assert.equal(gogo.user.userId, "gogo#1");

  return { dw1, dw2, gogo };
}

function loginOrRegisterUser(input) {
  return loginOrRegisterTestUser(request, input);
}

function sendAndAcceptFriendRequest(input) {
  return sendAndAcceptFriendRequestWithRequest(request, input);
}

function registerUser(input) {
  return registerTestUser(request, input);
}
