import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { beforeEach, test } from "node:test";
import { createApp } from "../server/app.js";
import { resetStore } from "../server/store.js";

let app;

beforeEach(() => {
  resetStore();
  app = createApp();
});

test("real-world UCLA trip flow covers organizer, participant, outsider, budget, expenses, and balances", async () => {
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
  const gogoBudgetAttempt = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(gogo.token),
    body: {
      mode: "per-person",
      perPersonBudget: 200
    }
  });
  const dw2DeleteOwnLunch = await request(`/api/trips/${tripId}/expenses/${lunch.body.expense.id}`, {
    method: "DELETE",
    headers: authHeaders(dw2.token)
  });

  assert.equal(dw2DeleteOrganizerExpense.status, 403);
  assert.deepEqual(dw2DeleteOrganizerExpense.body, {
    error: "Only the expense payer or trip organizer can delete this expense"
  });
  assert.equal(gogoBudgetAttempt.status, 403);
  assert.equal(dw2DeleteOwnLunch.status, 200);
  assert.equal(dw2DeleteOwnLunch.body.deletedExpenseId, lunch.body.expense.id);
  assertNetBalancesConserved(dw2DeleteOwnLunch.body.balances);

  const organizerDeleteHotel = await request(`/api/trips/${tripId}/expenses/${hotel.body.expense.id}`, {
    method: "DELETE",
    headers: authHeaders(dw1.token)
  });
  const additionalBudget = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      mode: "total",
      totalBudget: 600
    }
  });
  const editTrip = await request(`/api/trips/${tripId}`, {
    method: "PATCH",
    headers: authHeaders(dw1.token),
    body: {
      name: "UCLA Los Angeles Weekend",
      destination: "UCLA and Santa Monica",
      startDate: "2026-06-01",
      endDate: "2026-06-04",
      visibility: "private"
    }
  });
  const invalidDateTrip = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      name: "Impossible Date Trip",
      startDate: "2026-02-30"
    }
  });
  const invalidBudget = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(dw1.token),
    body: {
      mode: "total",
      totalBudget: 0
    }
  });
  const removeSelf = await request(`/api/trips/${tripId}/participants/${dw1.user.id}`, {
    method: "DELETE",
    headers: authHeaders(dw1.token)
  });
  const removeParticipantWithHistory = await request(
    `/api/trips/${tripId}/participants/${dw2.user.id}`,
    {
      method: "DELETE",
      headers: authHeaders(dw1.token)
    }
  );

  assert.equal(organizerDeleteHotel.status, 200);
  assert.equal(organizerDeleteHotel.body.deletedExpenseId, hotel.body.expense.id);
  assert.equal(additionalBudget.status, 200);
  assert.equal(additionalBudget.body.budgetSummary.mode, "total");
  assert.equal(additionalBudget.body.budgetSummary.totalBudget, 600);
  assert.equal(editTrip.status, 200);
  assert.equal(editTrip.body.trip.name, "UCLA Los Angeles Weekend");
  assert.equal(editTrip.body.trip.visibility, "private");
  assert.equal(invalidDateTrip.status, 400);
  assert.equal(invalidBudget.status, 400);
  assert.equal(removeSelf.status, 400);
  assert.deepEqual(removeSelf.body, {
    error: "Organizer cannot be removed from the trip"
  });
  assert.equal(removeParticipantWithHistory.status, 409);
  assert.deepEqual(removeParticipantWithHistory.body, {
    error: "Trip has already started; participants cannot be removed"
  });
});

test("extra registered outsider is blocked from private data and invalid expense roles", async () => {
  const { dw1, dw2 } = await registerCoreUsers();
  const outsiderEmail = `outsider-${Date.now()}@example.com`;
  const outsider = await registerUser({
    name: "outsider",
    email: outsiderEmail,
    password: "outsider-password"
  });
  const duplicateOutsider = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "outsider",
      email: outsiderEmail,
      password: "outsider-password"
    }
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
  assert.equal(duplicateOutsider.status, 409);
  assert.deepEqual(duplicateOutsider.body, {
    error: "An account with this email already exists"
  });
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

test("participant cannot use organizer-only trip controls but can record and delete own expenses", async () => {
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

  const editAttempt = await request(`/api/trips/${tripId}`, {
    method: "PATCH",
    headers: authHeaders(dw2.token),
    body: {
      name: "Participant Renamed Trip"
    }
  });
  const deleteTripAttempt = await request(`/api/trips/${tripId}`, {
    method: "DELETE",
    headers: authHeaders(dw2.token)
  });
  const addParticipantAttempt = await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(dw2.token),
    body: {
      name: "Blocked Guest",
      email: "blocked-guest@example.com"
    }
  });
  const inviteAttempt = await request(`/api/trips/${tripId}/invitations`, {
    method: "POST",
    headers: authHeaders(dw2.token),
    body: {
      userId: dw1.user.id
    }
  });
  const removeAttempt = await request(`/api/trips/${tripId}/participants/${dw1.user.id}`, {
    method: "DELETE",
    headers: authHeaders(dw2.token)
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

  assert.equal(editAttempt.status, 403);
  assert.equal(deleteTripAttempt.status, 403);
  assert.equal(addParticipantAttempt.status, 403);
  assert.equal(inviteAttempt.status, 403);
  assert.equal(removeAttempt.status, 403);
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
    password: "12345678"
  });
  const dw2 = await loginOrRegisterUser({
    identifier: "dw#2",
    name: "dw",
    email: "dw-two@example.com",
    password: "87654321"
  });
  const gogo = await loginOrRegisterUser({
    identifier: "gogo#1",
    name: "gogo",
    email: "gogo@example.com",
    password: "09876543"
  });

  assert.equal(dw1.user.userId, "dw#1");
  assert.equal(dw2.user.userId, "dw#2");
  assert.equal(gogo.user.userId, "gogo#1");

  return { dw1, dw2, gogo };
}

async function loginOrRegisterUser({ identifier, name, email, password }) {
  const loginResponse = await request("/api/auth/login", {
    method: "POST",
    body: {
      identifier,
      password
    }
  });

  if (loginResponse.status === 200) {
    return loginResponse.body;
  }

  return registerUser({ name, email, password });
}

async function sendAndAcceptFriendRequest({ requester, recipient }) {
  const requestResponse = await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(requester.token),
    body: {
      identifier: recipient.user.userId
    }
  });
  const recipientOverview = await request("/api/friends", {
    headers: authHeaders(recipient.token)
  });
  const acceptResponse = await request(
    `/api/friends/requests/${recipientOverview.body.incomingRequests[0].id}/accept`,
    {
      method: "POST",
      headers: authHeaders(recipient.token)
    }
  );

  assert.equal(requestResponse.status, 201);
  assert.equal(acceptResponse.status, 200);
  assert.equal(acceptResponse.body.request.status, "accepted");
}

async function registerUser({ name, email, password }) {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name,
      email,
      password
    }
  });

  assert.equal(response.status, 201);
  return response.body;
}

function assertBudget(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `Expected budget ${key} to equal ${value}`);
  }
}

function assertBalances(actualBalances, expectedBalances) {
  assert.deepEqual(
    normalizeBalances(actualBalances),
    expectedBalances.map((balance) => ({
      participantId: balance.participantId,
      actualPaid: balance.actualPaid,
      fairShare: balance.fairShare,
      netBalance: balance.netBalance
    }))
  );
}

function assertNetBalancesConserved(balances) {
  assert.equal(
    roundCurrency(balances.reduce((sum, balance) => sum + balance.netBalance, 0)),
    0
  );
}

function normalizeBalances(balances) {
  return balances.map(({ participantId, actualPaid, fairShare, netBalance }) => ({
    participantId,
    actualPaid,
    fairShare,
    netBalance
  }));
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`
  };
}

function request(path, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const rawBody = body === undefined ? null : JSON.stringify(body);
    const req = new Readable({
      read() {
        if (rawBody !== null) {
          this.push(rawBody);
        }
        this.push(null);
      }
    });
    req.method = method;
    req.url = path;
    req.headers = normalizeHeaders({
      ...headers,
      ...(rawBody === null
        ? {}
        : {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(rawBody)
          })
    });

    const chunks = [];
    const responseHeaders = {};
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });
    res.statusCode = 200;
    res.req = req;
    res.setHeader = (name, value) => {
      responseHeaders[name.toLowerCase()] = value;
    };
    res.getHeader = (name) => responseHeaders[name.toLowerCase()];
    res.getHeaders = () => responseHeaders;
    res.removeHeader = (name) => {
      delete responseHeaders[name.toLowerCase()];
    };
    res.writeHead = (statusCode, headers = {}) => {
      res.statusCode = statusCode;
      for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
      }
    };
    res.end = (chunk) => {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }

      const text = Buffer.concat(chunks).toString("utf8");
      resolve({
        status: res.statusCode,
        headers: responseHeaders,
        text,
        body: text ? JSON.parse(text) : null
      });
    };

    app.handle(req, res, reject);
  });
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
}
