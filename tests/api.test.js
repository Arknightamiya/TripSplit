import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Readable, Writable } from "node:stream";
import { beforeEach, test } from "node:test";
import { createApp } from "../server/app.js";
import { getLastRegistrationVerificationCode } from "../server/services/email.js";
import { seedStore } from "../server/services/seed.js";
import { resetStore, updatePendingRegistration } from "../server/store.js";

let app;

beforeEach(async () => {
  resetStore();
  await seedStore();
  app = createApp();
});

test("private trip APIs require bearer auth", async () => {
  const response = await request("/api/trips");

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    error: "Missing or invalid token"
  });
});

test("currency API returns fallback supported currencies without a database", async () => {
  const response = await request("/api/currencies");

  assert.equal(response.status, 200);
  assert.equal(response.body.baseCurrencyCode, "USD");
  assert.equal(response.body.rates.USD, 1);
  assert.equal(response.body.rates.JPY, 157);
  assert.ok(response.body.currencies.some((currency) => currency.code === "USD"));
  assert.ok(response.body.currencies.some((currency) => currency.code === "JPY" && currency.rate === 157));
});

test("invalid and expired tokens return explicit 401 session errors", async () => {
  const { user } = await loginAsDemoUser();
  const invalidTokenResponse = await request("/api/me", {
    headers: authHeaders("not-a-valid-jwt")
  });
  const expiredTokenResponse = await request("/api/me", {
    headers: authHeaders(signTestToken({
      sub: user.id,
      iat: 1,
      exp: 1
    }))
  });

  assert.equal(invalidTokenResponse.status, 401);
  assert.deepEqual(invalidTokenResponse.body, {
    error: "Missing or invalid token"
  });
  assert.equal(expiredTokenResponse.status, 401);
  assert.deepEqual(expiredTokenResponse.body, {
    error: "Token has expired"
  });
});

test("login returns JWT and lists trips for the authenticated participant", async () => {
  const { token } = await loginAsDemoUser();

  const response = await request("/api/trips", {
    headers: authHeaders(token)
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.trips.length, 1);
  assert.equal(response.body.trips[0].name, "San Diego Weekend");
  assert.equal(response.body.trips[0].budgetSummary.totalBudget, 900);
});

test("login accepts username or email as the identifier", async () => {
  const emailLogin = await loginAsDemoUser();
  const usernameLogin = await request("/api/auth/login", {
    method: "POST",
    body: {
      identifier: emailLogin.user.name,
      password: "Demo-password1!"
    }
  });

  assert.equal(usernameLogin.status, 200);
  assert.equal(usernameLogin.body.user.id, emailLogin.user.id);
  assert.equal(usernameLogin.body.token.split(".").length, 3);
});

test("register sends a verification code, then verify returns a JWT", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Taylor New",
      email: "taylor@example.com",
      password: "Demo-password1!"
    }
  });

  assert.equal(response.status, 202);
  assert.equal(response.body.email, "taylor@example.com");
  assert.equal(response.body.token, undefined);

  const verifyResponse = await request("/api/auth/register/verify", {
    method: "POST",
    body: {
      email: "taylor@example.com",
      code: getLastRegistrationVerificationCode("taylor@example.com")
    }
  });

  assert.equal(verifyResponse.status, 201);
  assert.equal(verifyResponse.body.user.email, "taylor@example.com");
  assert.equal(verifyResponse.body.user.userId, "Taylor New#1");
  assert.equal(verifyResponse.body.user.displayName, "Taylor New#1");
  assert.equal(verifyResponse.body.user.avatarUrl, "");
  assert.equal(verifyResponse.body.user.passwordHash, undefined);
  assert.equal(verifyResponse.body.token.split(".").length, 3);

  const tripsResponse = await request("/api/trips", {
    headers: authHeaders(verifyResponse.body.token)
  });

  assert.equal(tripsResponse.status, 200);
  assert.deepEqual(tripsResponse.body.trips, []);
});

test("registration assigns Discord-style user ID discriminators", async () => {
  const first = await registerUser({
    name: "miya",
    email: "miya-one@example.com"
  });
  const second = await registerUser({
    name: "miya",
    email: "miya-two@example.com"
  });
  const withTypedSuffix = await registerUser({
    name: "miya#99",
    email: "miya-three@example.com"
  });

  assert.equal(first.user.userId, "miya#1");
  assert.equal(second.user.userId, "miya#2");
  assert.equal(withTypedSuffix.user.userId, "miya#3");
});

test("authenticated user can update profile display name and avatar", async () => {
  const auth = await registerUser({
    name: "ProfileUser",
    email: "profile@example.com"
  });
  const avatarUrl = "data:image/png;base64,aGVsbG8=";

  const updateResponse = await request("/api/me", {
    method: "PATCH",
    headers: authHeaders(auth.token),
    body: {
      displayName: "Miya Traveler",
      avatarUrl
    }
  });
  const profileResponse = await request("/api/me", {
    headers: authHeaders(auth.token)
  });
  const loginResponse = await request("/api/auth/login", {
    method: "POST",
    body: {
      identifier: "ProfileUser",
      password: "Demo-password1!"
    }
  });
  const fullUserIdLoginResponse = await request("/api/auth/login", {
    method: "POST",
    body: {
      identifier: "ProfileUser#1",
      password: "Demo-password1!"
    }
  });

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.user.userId, "ProfileUser#1");
  assert.equal(updateResponse.body.user.name, "ProfileUser#1");
  assert.equal(updateResponse.body.user.displayName, "Miya Traveler");
  assert.equal(updateResponse.body.user.avatarUrl, avatarUrl);
  assert.equal(profileResponse.status, 200);
  assert.equal(profileResponse.body.user.displayName, "Miya Traveler");
  assert.equal(loginResponse.status, 401);
  assert.equal(fullUserIdLoginResponse.status, 200);
  assert.equal(fullUserIdLoginResponse.body.user.userId, "ProfileUser#1");
});

test("profile update keeps nickname required and rejects non-image avatars", async () => {
  const auth = await registerUser({
    name: "InvalidProfile",
    email: "invalid-profile@example.com"
  });

  const missingName = await request("/api/me", {
    method: "PATCH",
    headers: authHeaders(auth.token),
    body: {
      displayName: "",
      avatarUrl: ""
    }
  });
  const invalidAvatar = await request("/api/me", {
    method: "PATCH",
    headers: authHeaders(auth.token),
    body: {
      displayName: "Still Valid",
      avatarUrl: "https://example.com/avatar.png"
    }
  });

  assert.equal(missingName.status, 400);
  assert.deepEqual(missingName.body, {
    error: "Display name is required"
  });
  assert.equal(invalidAvatar.status, 400);
  assert.deepEqual(invalidAvatar.body, {
    error: "Avatar must be an uploaded image"
  });
});

test("friend request flow adds friends for both users", async () => {
  const alice = await registerUser({
    name: "FriendAlice",
    email: "friend-alice@example.com"
  });
  const bob = await registerUser({
    name: "FriendBob",
    email: "friend-bob@example.com"
  });

  const selfRequest = await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(alice.token),
    body: {
      identifier: alice.user.userId
    }
  });
  const sendRequest = await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(alice.token),
    body: {
      identifier: bob.user.email
    }
  });
  const duplicateRequest = await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(alice.token),
    body: {
      identifier: bob.user.email
    }
  });
  const bobOverviewBeforeAccept = await request("/api/friends", {
    headers: authHeaders(bob.token)
  });
  const acceptResponse = await request(
    `/api/friends/requests/${bobOverviewBeforeAccept.body.incomingRequests[0].id}/accept`,
    {
      method: "POST",
      headers: authHeaders(bob.token)
    }
  );
  const aliceOverview = await request("/api/friends", {
    headers: authHeaders(alice.token)
  });
  const bobOverview = await request("/api/friends", {
    headers: authHeaders(bob.token)
  });

  assert.equal(selfRequest.status, 400);
  assert.equal(sendRequest.status, 201);
  assert.equal(sendRequest.body.request.requester.id, alice.user.id);
  assert.equal(sendRequest.body.request.recipient.id, bob.user.id);
  assert.equal(duplicateRequest.status, 409);
  assert.equal(bobOverviewBeforeAccept.status, 200);
  assert.equal(bobOverviewBeforeAccept.body.incomingRequests.length, 1);
  assert.equal(acceptResponse.status, 200);
  assert.equal(acceptResponse.body.request.status, "accepted");
  assert.equal(aliceOverview.body.friends.length, 1);
  assert.equal(aliceOverview.body.friends[0].id, bob.user.id);
  assert.equal(bobOverview.body.friends.length, 1);
  assert.equal(bobOverview.body.friends[0].id, alice.user.id);
});

test("friend search matches display names", async () => {
  const alice = await registerUser({
    name: "SearchAlice",
    email: "search-alice@example.com"
  });
  const bob = await registerUser({
    name: "SearchBob",
    email: "search-bob@example.com"
  });

  await request("/api/me", {
    method: "PATCH",
    headers: authHeaders(bob.token),
    body: {
      displayName: "Weekend Buddy",
      avatarUrl: ""
    }
  });
  const searchResponse = await request("/api/friends/search?query=Weekend", {
    headers: authHeaders(alice.token)
  });

  assert.equal(searchResponse.status, 200);
  assert.equal(searchResponse.body.users.length, 1);
  assert.equal(searchResponse.body.users[0].id, bob.user.id);
});

test("declined friend request does not create friendship", async () => {
  const alice = await registerUser({
    name: "DeclineAlice",
    email: "decline-alice@example.com"
  });
  const bob = await registerUser({
    name: "DeclineBob",
    email: "decline-bob@example.com"
  });

  await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(alice.token),
    body: {
      identifier: bob.user.userId
    }
  });
  const bobOverviewBeforeDecline = await request("/api/friends", {
    headers: authHeaders(bob.token)
  });
  const declineResponse = await request(
    `/api/friends/requests/${bobOverviewBeforeDecline.body.incomingRequests[0].id}/decline`,
    {
      method: "POST",
      headers: authHeaders(bob.token)
    }
  );
  const bobOverview = await request("/api/friends", {
    headers: authHeaders(bob.token)
  });

  assert.equal(declineResponse.status, 200);
  assert.equal(declineResponse.body.request.status, "declined");
  assert.deepEqual(bobOverview.body.friends, []);
  assert.deepEqual(bobOverview.body.incomingRequests, []);
});

test("friends can request to join public trips", async () => {
  const organizer = await registerUser({
    name: "PublicTripOwner",
    email: "public-owner@example.com"
  });
  const friend = await registerUser({
    name: "PublicTripFriend",
    email: "public-friend@example.com"
  });
  const outsider = await registerUser({
    name: "PublicTripOutsider",
    email: "public-outsider@example.com"
  });

  await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(friend.token),
    body: {
      identifier: organizer.user.userId
    }
  });
  const organizerOverviewBeforeAccept = await request("/api/friends", {
    headers: authHeaders(organizer.token)
  });
  await request(
    `/api/friends/requests/${organizerOverviewBeforeAccept.body.incomingRequests[0].id}/accept`,
    {
      method: "POST",
      headers: authHeaders(organizer.token)
    }
  );

  const publicTripResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      name: "Public Yosemite Trip",
      visibility: "public"
    }
  });
  const privateTripResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      name: "Private Vegas Trip",
      visibility: "private"
    }
  });
  const friendProfile = await request(`/api/friends/${organizer.user.id}`, {
    headers: authHeaders(friend.token)
  });
  const friendPublicTripLobby = await request("/api/friends/public-trips", {
    headers: authHeaders(friend.token)
  });
  const outsiderJoinResponse = await request(
    `/api/friends/trips/${publicTripResponse.body.trip.id}/join-requests`,
    {
      method: "POST",
      headers: authHeaders(outsider.token)
    }
  );
  const friendJoinResponse = await request(
    `/api/friends/trips/${publicTripResponse.body.trip.id}/join-requests`,
    {
      method: "POST",
      headers: authHeaders(friend.token)
    }
  );
  const organizerOverview = await request("/api/friends", {
    headers: authHeaders(organizer.token)
  });
  const acceptJoinResponse = await request(
    `/api/friends/trip-join-requests/${organizerOverview.body.tripJoinRequests[0].id}/accept`,
    {
      method: "POST",
      headers: authHeaders(organizer.token)
    }
  );
  const friendTripDetail = await request(`/api/trips/${publicTripResponse.body.trip.id}`, {
    headers: authHeaders(friend.token)
  });
  const hiddenPrivateTrip = await request(`/api/trips/${privateTripResponse.body.trip.id}`, {
    headers: authHeaders(friend.token)
  });

  assert.equal(publicTripResponse.status, 201);
  assert.equal(publicTripResponse.body.trip.visibility, "public");
  assert.equal(privateTripResponse.status, 201);
  assert.equal(friendProfile.status, 200);
  assert.equal(friendProfile.body.publicTrips.length, 1);
  assert.equal(friendProfile.body.publicTrips[0].id, publicTripResponse.body.trip.id);
  assert.equal(friendPublicTripLobby.status, 200);
  assert.equal(friendPublicTripLobby.body.publicTrips.length, 1);
  assert.equal(friendPublicTripLobby.body.publicTrips[0].id, publicTripResponse.body.trip.id);
  assert.equal(friendPublicTripLobby.body.publicTrips[0].organizer.id, organizer.user.id);
  assert.equal(outsiderJoinResponse.status, 403);
  assert.equal(friendJoinResponse.status, 201);
  assert.equal(organizerOverview.body.tripJoinRequests.length, 1);
  assert.equal(organizerOverview.body.tripJoinRequests[0].requester.id, friend.user.id);
  assert.equal(organizerOverview.body.tripJoinRequests[0].trip.organizer.id, organizer.user.id);
  assert.equal(acceptJoinResponse.status, 200);
  assert.equal(acceptJoinResponse.body.request.status, "accepted");
  assert.equal(friendTripDetail.status, 200);
  assert.equal(friendTripDetail.body.trip.id, publicTripResponse.body.trip.id);
  assert.equal(hiddenPrivateTrip.status, 403);
});

test("deleting a friend removes both directions and hides public trips", async () => {
  const organizer = await registerUser({
    name: "DeleteFriendOwner",
    email: "delete-friend-owner@example.com"
  });
  const friend = await registerUser({
    name: "DeleteFriendViewer",
    email: "delete-friend-viewer@example.com"
  });

  await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(friend.token),
    body: {
      identifier: organizer.user.userId
    }
  });
  const organizerOverviewBeforeAccept = await request("/api/friends", {
    headers: authHeaders(organizer.token)
  });
  await request(
    `/api/friends/requests/${organizerOverviewBeforeAccept.body.incomingRequests[0].id}/accept`,
    {
      method: "POST",
      headers: authHeaders(organizer.token)
    }
  );

  const publicTripResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      name: "Visible Before Delete",
      visibility: "public"
    }
  });
  const friendProfileBeforeDelete = await request(`/api/friends/${organizer.user.id}`, {
    headers: authHeaders(friend.token)
  });
  const lobbyBeforeDelete = await request("/api/friends/public-trips", {
    headers: authHeaders(friend.token)
  });
  const deleteResponse = await request(`/api/friends/${friend.user.id}`, {
    method: "DELETE",
    headers: authHeaders(organizer.token)
  });
  const organizerOverviewAfterDelete = await request("/api/friends", {
    headers: authHeaders(organizer.token)
  });
  const friendOverviewAfterDelete = await request("/api/friends", {
    headers: authHeaders(friend.token)
  });
  const friendProfileAfterDelete = await request(`/api/friends/${organizer.user.id}`, {
    headers: authHeaders(friend.token)
  });
  const lobbyAfterDelete = await request("/api/friends/public-trips", {
    headers: authHeaders(friend.token)
  });
  const joinAfterDelete = await request(
    `/api/friends/trips/${publicTripResponse.body.trip.id}/join-requests`,
    {
      method: "POST",
      headers: authHeaders(friend.token)
    }
  );

  assert.equal(friendProfileBeforeDelete.status, 200);
  assert.equal(friendProfileBeforeDelete.body.publicTrips.length, 1);
  assert.equal(lobbyBeforeDelete.status, 200);
  assert.equal(lobbyBeforeDelete.body.publicTrips.length, 1);
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.body.removed, true);
  assert.equal(organizerOverviewAfterDelete.body.friends.length, 0);
  assert.equal(friendOverviewAfterDelete.body.friends.length, 0);
  assert.equal(friendProfileAfterDelete.status, 404);
  assert.deepEqual(friendProfileAfterDelete.body, {
    error: "Friend not found"
  });
  assert.equal(lobbyAfterDelete.status, 200);
  assert.equal(lobbyAfterDelete.body.publicTrips.length, 0);
  assert.equal(joinAfterDelete.status, 403);
});

test("social trip flow closes invites, public visibility, and join approvals", async () => {
  const user1 = await registerUser({
    name: "dw",
    email: "dw-one@example.com",
    password: "Dw-One_123"
  });
  const user2 = await registerUser({
    name: "dw",
    email: "dw-two@example.com",
    password: "Dw-Two_123"
  });
  const user3 = await registerUser({
    name: "gogo",
    email: "go234@example.com",
    password: "Go-Go_123"
  });

  assert.equal(user1.user.userId, "dw#1");
  assert.equal(user2.user.userId, "dw#2");
  assert.equal(user3.user.userId, "gogo#1");

  await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(user2.token),
    body: {
      identifier: user1.user.userId
    }
  });
  const user1BeforeAcceptingUser2 = await request("/api/friends", {
    headers: authHeaders(user1.token)
  });
  await request(
    `/api/friends/requests/${user1BeforeAcceptingUser2.body.incomingRequests[0].id}/accept`,
    {
      method: "POST",
      headers: authHeaders(user1.token)
    }
  );

  const publicTripResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(user1.token),
    body: {
      name: "UCLA Los Angeles",
      destination: "UCLA Los Angeles",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      visibility: "public",
      inviteeUserIds: [user2.user.id]
    }
  });
  const privateTripResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(user1.token),
    body: {
      name: "Private Planning Trip",
      destination: "Private Planning Trip",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      visibility: "private"
    }
  });
  const tripId = publicTripResponse.body.trip.id;
  const privateTripId = privateTripResponse.body.trip.id;
  const user2BeforeInviteAccept = await request("/api/friends", {
    headers: authHeaders(user2.token)
  });
  const user2TripBeforeInviteAccept = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(user2.token)
  });
  const user1TripListBeforeInviteAccept = await request("/api/trips", {
    headers: authHeaders(user1.token)
  });

  assert.equal(publicTripResponse.status, 201);
  assert.equal(publicTripResponse.body.trip.visibility, "public");
  assert.equal(privateTripResponse.status, 201);
  assert.equal(privateTripResponse.body.trip.visibility, "private");
  assert.equal(user2TripBeforeInviteAccept.status, 403);
  assert.equal(user2BeforeInviteAccept.body.tripInvitations.length, 1);
  assert.equal(user2BeforeInviteAccept.body.tripInvitations[0].trip.id, tripId);
  assert.equal(
    user1TripListBeforeInviteAccept.body.trips.find((trip) => trip.id === tripId).participantCount,
    1
  );

  const user2AcceptInviteResponse = await request(`/api/friends/trip-invitations/${tripId}/accept`, {
    method: "POST",
    headers: authHeaders(user2.token)
  });
  const user2TripAfterInviteAccept = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(user2.token)
  });
  const user1TripListAfterInviteAccept = await request("/api/trips", {
    headers: authHeaders(user1.token)
  });

  assert.equal(user2AcceptInviteResponse.status, 200);
  assert.equal(user2AcceptInviteResponse.body.invitation.status, "accepted");
  assert.equal(user2TripAfterInviteAccept.status, 200);
  assert.equal(
    user2TripAfterInviteAccept.body.trip.participants.find(
      (participant) => participant.id === user2.user.id
    ).joinStatus,
    "approved"
  );
  assert.equal(
    user1TripListAfterInviteAccept.body.trips.find((trip) => trip.id === tripId).participantCount,
    2
  );

  const user3LobbyBeforeFriendship = await request("/api/friends/public-trips", {
    headers: authHeaders(user3.token)
  });
  const user3JoinBeforeFriendship = await request(`/api/friends/trips/${tripId}/join-requests`, {
    method: "POST",
    headers: authHeaders(user3.token)
  });

  assert.equal(user3LobbyBeforeFriendship.status, 200);
  assert.equal(user3LobbyBeforeFriendship.body.publicTrips.length, 0);
  assert.equal(user3JoinBeforeFriendship.status, 403);

  await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(user3.token),
    body: {
      identifier: user1.user.userId
    }
  });
  const user1BeforeAcceptingUser3 = await request("/api/friends", {
    headers: authHeaders(user1.token)
  });
  const user3FriendRequest = user1BeforeAcceptingUser3.body.incomingRequests.find(
    (requestEntry) => requestEntry.requester.id === user3.user.id
  );
  await request(`/api/friends/requests/${user3FriendRequest.id}/accept`, {
    method: "POST",
    headers: authHeaders(user1.token)
  });

  const user3LobbyAfterFriendship = await request("/api/friends/public-trips", {
    headers: authHeaders(user3.token)
  });
  const user3FriendProfile = await request(`/api/friends/${user1.user.id}`, {
    headers: authHeaders(user3.token)
  });

  assert.equal(user3LobbyAfterFriendship.status, 200);
  assert.deepEqual(
    user3LobbyAfterFriendship.body.publicTrips.map((trip) => trip.id),
    [tripId]
  );
  assert.deepEqual(
    user3FriendProfile.body.publicTrips.map((trip) => trip.id),
    [tripId]
  );
  assert.equal(
    user3LobbyAfterFriendship.body.publicTrips.some((trip) => trip.id === privateTripId),
    false
  );

  const user3JoinResponse = await request(`/api/friends/trips/${tripId}/join-requests`, {
    method: "POST",
    headers: authHeaders(user3.token)
  });
  const user3TripBeforeJoinApproval = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(user3.token)
  });
  const user1BeforeJoinApproval = await request("/api/friends", {
    headers: authHeaders(user1.token)
  });
  const user3JoinRequest = user1BeforeJoinApproval.body.tripJoinRequests.find(
    (requestEntry) =>
      requestEntry.requester.id === user3.user.id &&
      requestEntry.trip.id === tripId
  );
  const approveJoinResponse = await request(
    `/api/friends/trip-join-requests/${user3JoinRequest.id}/accept`,
    {
      method: "POST",
      headers: authHeaders(user1.token)
    }
  );
  const user3TripAfterJoinApproval = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(user3.token)
  });
  const user1TripListAfterJoinApproval = await request("/api/trips", {
    headers: authHeaders(user1.token)
  });

  assert.equal(user3JoinResponse.status, 201);
  assert.equal(user3JoinResponse.body.request.status, "pending");
  assert.equal(user3TripBeforeJoinApproval.status, 403);
  assert.equal(user3JoinRequest.trip.destination, "UCLA Los Angeles");
  assert.equal(user3JoinRequest.trip.startDate, "2026-06-01");
  assert.equal(user3JoinRequest.trip.endDate, "2026-06-03");
  assert.equal(approveJoinResponse.status, 200);
  assert.equal(approveJoinResponse.body.request.status, "accepted");
  assert.equal(user3TripAfterJoinApproval.status, 200);
  assert.equal(
    user3TripAfterJoinApproval.body.trip.participants.find(
      (participant) => participant.id === user3.user.id
    ).joinStatus,
    "approved"
  );
  assert.equal(
    user1TripListAfterJoinApproval.body.trips.find((trip) => trip.id === tripId).participantCount,
    3
  );
});

test("duplicate registration is rejected", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Alex Duplicate",
      email: "alex@example.com",
      password: "Demo-password1!"
    }
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "An account with this email already exists"
  });
});

test("registration rejects passwords that do not meet strength rules", async () => {
  const weakPasswords = [
    ["short", "short-password@example.com"],
    ["lowercase1!", "no-uppercase@example.com"],
    ["UPPERCASE1!", "no-lowercase@example.com"],
    ["NoNumber!", "no-number@example.com"],
    ["NoSymbol1", "no-symbol@example.com"]
  ];

  for (const [password, email] of weakPasswords) {
    const response = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Weak Password",
        email,
        password
      }
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "Password must be at least 8 characters long and include uppercase, lowercase, number, and symbol."
    });
  }
});

test("registration accepts dash and underscore as password symbols", async () => {
  const dashResponse = await startRegistration({
    name: "Dash Password",
    email: "dash-password@example.com",
    password: "Dashpass1-"
  });
  const underscoreResponse = await startRegistration({
    name: "Underscore Password",
    email: "underscore-password@example.com",
    password: "Underpass1_"
  });

  assert.equal(dashResponse.message, "Verification code sent");
  assert.equal(underscoreResponse.message, "Verification code sent");
});

test("registration verification rejects invalid, expired, and over-attempted codes", async () => {
  await startRegistration({
    name: "Verify Errors",
    email: "verify-errors@example.com"
  });

  const invalidResponse = await request("/api/auth/register/verify", {
    method: "POST",
    body: {
      email: "verify-errors@example.com",
      code: "000000"
    }
  });

  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(invalidResponse.body, {
    error: "Invalid verification code"
  });

  updatePendingRegistration("verify-errors@example.com", {
    expiresAt: new Date(Date.now() - 1000).toISOString()
  });

  const expiredResponse = await request("/api/auth/register/verify", {
    method: "POST",
    body: {
      email: "verify-errors@example.com",
      code: getLastRegistrationVerificationCode("verify-errors@example.com")
    }
  });

  assert.equal(expiredResponse.status, 400);
  assert.deepEqual(expiredResponse.body, {
    error: "Verification code has expired. Please resend a new code."
  });

  await startRegistration({
    name: "Verify Attempts",
    email: "verify-attempts@example.com"
  });
  updatePendingRegistration("verify-attempts@example.com", {
    attemptCount: 5
  });

  const attemptsResponse = await request("/api/auth/register/verify", {
    method: "POST",
    body: {
      email: "verify-attempts@example.com",
      code: getLastRegistrationVerificationCode("verify-attempts@example.com")
    }
  });

  assert.equal(attemptsResponse.status, 400);
  assert.deepEqual(attemptsResponse.body, {
    error: "Too many incorrect attempts. Please resend a new code."
  });
});

test("re-registering a pending email refreshes the latest code", async () => {
  await startRegistration({
    name: "Pending First",
    email: "pending-refresh@example.com"
  });
  const firstCode = getLastRegistrationVerificationCode("pending-refresh@example.com");

  await startRegistration({
    name: "Pending Second",
    email: "pending-refresh@example.com"
  });
  const secondCode = getLastRegistrationVerificationCode("pending-refresh@example.com");

  const oldCodeResponse = await request("/api/auth/register/verify", {
    method: "POST",
    body: {
      email: "pending-refresh@example.com",
      code: firstCode
    }
  });

  assert.equal(oldCodeResponse.status, 400);

  const verified = await request("/api/auth/register/verify", {
    method: "POST",
    body: {
      email: "pending-refresh@example.com",
      code: secondCode
    }
  });

  assert.equal(verified.status, 201);
  assert.equal(verified.body.user.userId, "Pending Second#1");
});

test("resend registration code refreshes code and enforces cooldown", async () => {
  await startRegistration({
    name: "Resend User",
    email: "resend-user@example.com"
  });

  const cooldownResponse = await request("/api/auth/register/resend-code", {
    method: "POST",
    body: {
      email: "resend-user@example.com"
    }
  });

  assert.equal(cooldownResponse.status, 400);
  assert.equal(cooldownResponse.body.error, "Please wait before requesting another verification code");
  assert.ok(cooldownResponse.body.retryAfterSeconds > 0);
  assert.ok(cooldownResponse.body.retryAfterSeconds <= 60);

  updatePendingRegistration("resend-user@example.com", {
    resendAvailableAt: new Date(Date.now() - 1000).toISOString()
  });
  const firstCode = getLastRegistrationVerificationCode("resend-user@example.com");

  const resendResponse = await request("/api/auth/register/resend-code", {
    method: "POST",
    body: {
      email: "resend-user@example.com"
    }
  });

  assert.equal(resendResponse.status, 200);
  assert.notEqual(getLastRegistrationVerificationCode("resend-user@example.com"), firstCode);
});

test("trip creation uses the token user as organizer", async () => {
  const { token, user } = await loginAsDemoUser();

  const response = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Joshua Tree",
      destination: "Joshua Tree",
      organizerId: "user_999"
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.trip.organizerId, user.id);
  assert.deepEqual(response.body.trip.participantIds, [user.id]);
});

test("organizer can update trip destination, dates, and visibility", async () => {
  const { token } = await loginAsDemoUser();
  const createResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Draft Trip",
      destination: "Draft Trip",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      visibility: "public"
    }
  });
  const tripId = createResponse.body.trip.id;

  const updateResponse = await request(`/api/trips/${tripId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: {
      name: "Big Bear Weekend",
      destination: "Big Bear Weekend",
      startDate: "2026-05-27",
      endDate: "2026-06-27",
      visibility: "private"
    }
  });
  const detailResponse = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(token)
  });
  const listResponse = await request("/api/trips", {
    headers: authHeaders(token)
  });
  const listTrip = listResponse.body.trips.find((trip) => trip.id === tripId);

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.trip.name, "Big Bear Weekend");
  assert.equal(updateResponse.body.trip.startDate, "2026-05-27");
  assert.equal(updateResponse.body.trip.endDate, "2026-06-27");
  assert.equal(updateResponse.body.trip.visibility, "private");
  assert.equal(detailResponse.body.trip.destination, "Big Bear Weekend");
  assert.equal(listTrip.visibility, "private");
  assert.equal(listTrip.startDate, "2026-05-27");
  assert.equal(listTrip.budgetSummary, null);
});

test("trip APIs reject malformed and invalid dates", async () => {
  const { token } = await loginAsDemoUser();

  const longYearResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Bad Year",
      destination: "Bad Year",
      startDate: "12345-06-01",
      endDate: "12345-06-03"
    }
  });
  const invalidMonthResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Bad Month",
      destination: "Bad Month",
      startDate: "2026-13-01"
    }
  });
  const invalidDayResponse = await request("/api/trips/trip_4", {
    method: "PATCH",
    headers: authHeaders(token),
    body: {
      name: "Bad Day",
      destination: "Bad Day",
      startDate: "2026-02-30"
    }
  });
  const invalidRangeResponse = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Bad Range",
      destination: "Bad Range",
      startDate: "2026-06-03",
      endDate: "2026-06-01"
    }
  });

  assert.equal(longYearResponse.status, 400);
  assert.deepEqual(longYearResponse.body, {
    error: "Start date must use YYYY-MM-DD with a 4-digit year"
  });
  assert.equal(invalidMonthResponse.status, 400);
  assert.deepEqual(invalidMonthResponse.body, {
    error: "Start date must be a valid calendar date"
  });
  assert.equal(invalidDayResponse.status, 400);
  assert.deepEqual(invalidDayResponse.body, {
    error: "Start date must be a valid calendar date"
  });
  assert.equal(invalidRangeResponse.status, 400);
  assert.deepEqual(invalidRangeResponse.body, {
    error: "End date must be on or after start date"
  });
});

test("regular participants cannot update trip metadata", async () => {
  const { token } = await loginAsDemoUser({
    email: "sam@example.com",
    password: "Demo-password1!"
  });

  const response = await request("/api/trips/trip_4", {
    method: "PATCH",
    headers: authHeaders(token),
    body: {
      name: "Blocked Rename",
      visibility: "public"
    }
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    error: "Only an organizer can perform this action"
  });
});

test("non-participant cannot view private trip details", async () => {
  const organizer = await loginAsDemoUser();
  const tripId = await createTrip(organizer.token);
  const outsider = await registerUser({
    name: "Outsider",
    email: "outsider@example.com"
  });

  const response = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(outsider.token)
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    error: "You are not an approved participant on this trip"
  });
});

test("organizer can delete a trip", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const deleteResponse = await request(`/api/trips/${tripId}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  const listResponse = await request("/api/trips", {
    headers: authHeaders(token)
  });

  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(deleteResponse.body, {
    deletedTripId: tripId
  });
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.trips.some((trip) => trip.id === tripId), false);
});

test("regular participants cannot delete a trip", async () => {
  const { token } = await loginAsDemoUser({
    email: "sam@example.com",
    password: "Demo-password1!"
  });

  const response = await request("/api/trips/trip_4", {
    method: "DELETE",
    headers: authHeaders(token)
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    error: "Only an organizer can perform this action"
  });
});

test("organizer can add participants by email", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const response = await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Riley Traveler",
      email: "riley@example.com",
      role: "participant"
    }
  });

  assert.equal(response.status, 200);
  const participant = response.body.trip.participants.find(
    (entry) => entry.email === "riley@example.com"
  );
  assert.equal(participant.role, "participant");
  assert.equal(participant.joinStatus, "approved");
});

test("organizer can add an existing user by id", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);
  const riley = await registerUser({
    name: "Riley Existing",
    email: "riley-existing@example.com"
  });

  const response = await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      userId: riley.user.id,
      role: "participant"
    }
  });

  assert.equal(response.status, 200);
  const participant = response.body.trip.participants.find(
    (entry) => entry.id === riley.user.id
  );
  assert.equal(participant.email, "riley-existing@example.com");
  assert.equal(participant.role, "participant");
  assert.equal(participant.joinStatus, "approved");
});

test("trip invitation stays pending and does not increase approved participant count", async () => {
  const organizer = await registerUser({
    name: "InviteOwner",
    email: "invite-owner@example.com"
  });
  const invitee = await registerUser({
    name: "InvitePending",
    email: "invite-pending@example.com"
  });
  const tripId = await createTrip(organizer.token);

  const inviteResponse = await request(`/api/trips/${tripId}/invitations`, {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      userId: invitee.user.id
    }
  });
  const listResponse = await request("/api/trips", {
    headers: authHeaders(organizer.token)
  });
  const inviteeTripBeforeAccept = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(invitee.token)
  });
  const inviteeOverview = await request("/api/friends", {
    headers: authHeaders(invitee.token)
  });

  assert.equal(inviteResponse.status, 200);
  const pendingParticipant = inviteResponse.body.trip.participants.find(
    (participant) => participant.id === invitee.user.id
  );
  assert.equal(pendingParticipant.joinStatus, "pending");
  assert.equal(pendingParticipant.role, "participant");
  assert.equal(
    listResponse.body.trips.find((trip) => trip.id === tripId).participantCount,
    1
  );
  assert.equal(inviteeTripBeforeAccept.status, 403);
  assert.equal(inviteeOverview.body.tripInvitations.length, 1);
  assert.equal(inviteeOverview.body.tripInvitations[0].trip.id, tripId);
});

test("trip creation can include pending friend invitations", async () => {
  const organizer = await registerUser({
    name: "CreateInviteOwner",
    email: "create-invite-owner@example.com"
  });
  const invitee = await registerUser({
    name: "CreateInvitee",
    email: "create-invitee@example.com"
  });

  await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(invitee.token),
    body: {
      identifier: organizer.user.userId
    }
  });
  const organizerOverviewBeforeAccept = await request("/api/friends", {
    headers: authHeaders(organizer.token)
  });
  await request(
    `/api/friends/requests/${organizerOverviewBeforeAccept.body.incomingRequests[0].id}/accept`,
    {
      method: "POST",
      headers: authHeaders(organizer.token)
    }
  );

  const response = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      name: "Create With Invites",
      destination: "Create With Invites",
      visibility: "public",
      inviteeUserIds: [invitee.user.id]
    }
  });

  assert.equal(response.status, 201);
  const tripId = response.body.trip.id;
  const organizerParticipant = response.body.trip.participants.find(
    (participant) => participant.id === organizer.user.id
  );
  const pendingParticipant = response.body.trip.participants.find(
    (participant) => participant.id === invitee.user.id
  );
  assert.equal(organizerParticipant.joinStatus, "approved");
  assert.equal(pendingParticipant.joinStatus, "pending");

  const listResponse = await request("/api/trips", {
    headers: authHeaders(organizer.token)
  });
  const inviteeTripBeforeAccept = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(invitee.token)
  });
  const inviteeOverview = await request("/api/friends", {
    headers: authHeaders(invitee.token)
  });
  const inviteePublicTripLobby = await request("/api/friends/public-trips", {
    headers: authHeaders(invitee.token)
  });
  const inviteeJoinRequestResponse = await request(`/api/friends/trips/${tripId}/join-requests`, {
    method: "POST",
    headers: authHeaders(invitee.token)
  });

  assert.equal(
    listResponse.body.trips.find((trip) => trip.id === tripId).participantCount,
    1
  );
  assert.equal(inviteeTripBeforeAccept.status, 403);
  assert.equal(inviteeOverview.body.tripInvitations.length, 1);
  assert.equal(inviteeOverview.body.tripInvitations[0].trip.id, tripId);
  assert.equal(inviteeOverview.body.tripInvitations[0].organizer.id, organizer.user.id);
  assert.equal(inviteeOverview.body.tripInvitations[0].trip.organizer.id, organizer.user.id);
  assert.equal(inviteePublicTripLobby.status, 200);
  assert.equal(inviteePublicTripLobby.body.publicTrips.length, 1);
  assert.equal(inviteePublicTripLobby.body.publicTrips[0].id, tripId);
  assert.equal(inviteePublicTripLobby.body.publicTrips[0].invitationStatus, "pending");
  assert.equal(inviteeJoinRequestResponse.status, 409);
});

test("invited user can accept or decline trip invitations", async () => {
  const organizer = await registerUser({
    name: "InviteActionOwner",
    email: "invite-action-owner@example.com"
  });
  const acceptingInvitee = await registerUser({
    name: "InviteAccepting",
    email: "invite-accepting@example.com"
  });
  const decliningInvitee = await registerUser({
    name: "InviteDeclining",
    email: "invite-declining@example.com"
  });
  const tripId = await createTrip(organizer.token);

  await request(`/api/trips/${tripId}/invitations`, {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      userId: acceptingInvitee.user.id
    }
  });
  await request(`/api/trips/${tripId}/invitations`, {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      userId: decliningInvitee.user.id
    }
  });

  const acceptResponse = await request(`/api/friends/trip-invitations/${tripId}/accept`, {
    method: "POST",
    headers: authHeaders(acceptingInvitee.token)
  });
  const declineResponse = await request(`/api/friends/trip-invitations/${tripId}/decline`, {
    method: "POST",
    headers: authHeaders(decliningInvitee.token)
  });
  const acceptedTripDetail = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(acceptingInvitee.token)
  });
  const declinedTripDetail = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(decliningInvitee.token)
  });
  const organizerTripDetail = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(organizer.token)
  });

  assert.equal(acceptResponse.status, 200);
  assert.equal(acceptResponse.body.invitation.status, "accepted");
  assert.equal(declineResponse.status, 200);
  assert.equal(declineResponse.body.invitation.status, "declined");
  assert.equal(acceptedTripDetail.status, 200);
  assert.equal(declinedTripDetail.status, 403);
  assert.equal(
    acceptedTripDetail.body.trip.participants.find(
      (participant) => participant.id === acceptingInvitee.user.id
    ).joinStatus,
    "approved"
  );
  assert.equal(
    organizerTripDetail.body.trip.participants.some(
      (participant) => participant.id === decliningInvitee.user.id
    ),
    false
  );
});

test("organizer can remove pending invitations and approved participants", async () => {
  const organizer = await registerUser({
    name: "RemoveOwner",
    email: "remove-owner@example.com"
  });
  const pendingInvitee = await registerUser({
    name: "RemovePending",
    email: "remove-pending@example.com"
  });
  const approvedMember = await registerUser({
    name: "RemoveMember",
    email: "remove-member@example.com"
  });
  const tripId = await createTrip(organizer.token);

  await request(`/api/trips/${tripId}/invitations`, {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      userId: pendingInvitee.user.id
    }
  });
  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      userId: approvedMember.user.id
    }
  });

  const removePendingResponse = await request(
    `/api/trips/${tripId}/participants/${pendingInvitee.user.id}`,
    {
      method: "DELETE",
      headers: authHeaders(organizer.token)
    }
  );
  const removeApprovedResponse = await request(
    `/api/trips/${tripId}/participants/${approvedMember.user.id}`,
    {
      method: "DELETE",
      headers: authHeaders(organizer.token)
    }
  );
  const organizerTripDetail = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(organizer.token)
  });
  const pendingInviteeOverview = await request("/api/friends", {
    headers: authHeaders(pendingInvitee.token)
  });
  const organizerTripList = await request("/api/trips", {
    headers: authHeaders(organizer.token)
  });

  assert.equal(removePendingResponse.status, 200);
  assert.equal(removePendingResponse.body.removedParticipantId, pendingInvitee.user.id);
  assert.equal(removeApprovedResponse.status, 200);
  assert.equal(removeApprovedResponse.body.removedParticipantId, approvedMember.user.id);
  assert.equal(
    organizerTripDetail.body.trip.participants.some(
      (participant) =>
        participant.id === pendingInvitee.user.id ||
        participant.id === approvedMember.user.id
    ),
    false
  );
  assert.equal(pendingInviteeOverview.body.tripInvitations.length, 0);
  assert.equal(
    organizerTripList.body.trips.find((trip) => trip.id === tripId).participantCount,
    1
  );
});

test("organizer can start a trip", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const response = await request(`/api/trips/${tripId}/start`, {
    method: "POST",
    headers: authHeaders(token)
  });
  const tripDetail = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(token)
  });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.trip.startedAt, "string");
  assert.equal(tripDetail.body.trip.startedAt, response.body.trip.startedAt);
});

test("regular participants cannot start or end a trip", async () => {
  const organizer = await loginAsDemoUser();
  const participant = await loginAsDemoUser({
    email: "sam@example.com",
    password: "Demo-password1!"
  });
  const tripId = await createTrip(organizer.token);
  const addParticipantResponse = await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      userId: participant.user.id
    }
  });

  assert.equal(addParticipantResponse.status, 200);
  const startResponse = await request(`/api/trips/${tripId}/start`, {
    method: "POST",
    headers: authHeaders(participant.token)
  });
  await startTripForTest(organizer.token, tripId);
  const endResponse = await request(`/api/trips/${tripId}/end`, {
    method: "POST",
    headers: authHeaders(participant.token)
  });

  assert.equal(startResponse.status, 403);
  assert.deepEqual(startResponse.body, {
    error: "Only an organizer can perform this action"
  });
  assert.equal(endResponse.status, 403);
  assert.deepEqual(endResponse.body, {
    error: "Only an organizer can perform this action"
  });
});

test("started trips lock trip metadata and deletion", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  await startTripForTest(token, tripId);

  const updateResponse = await request(`/api/trips/${tripId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: {
      name: "Edited After Start",
      destination: "Edited After Start"
    }
  });
  const deleteResponse = await request(`/api/trips/${tripId}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  const detailResponse = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(token)
  });

  assert.equal(updateResponse.status, 409);
  assert.deepEqual(updateResponse.body, {
    error: "Trip has already started; trip details are locked"
  });
  assert.equal(deleteResponse.status, 409);
  assert.deepEqual(deleteResponse.body, {
    error: "Trip has already started; trip deletion is locked"
  });
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.trip.name, "API Test Trip");
});

test("started trips cannot add or invite participants", async () => {
  const organizer = await registerUser({
    name: "StartedParticipantOwner",
    email: "started-participant-owner@example.com"
  });
  const addTarget = await registerUser({
    name: "StartedAddTarget",
    email: "started-add-target@example.com"
  });
  const inviteTarget = await registerUser({
    name: "StartedInviteTarget",
    email: "started-invite-target@example.com"
  });
  const tripId = await createTrip(organizer.token);

  await startTripForTest(organizer.token, tripId);

  const addResponse = await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      userId: addTarget.user.id
    }
  });
  const inviteResponse = await request(`/api/trips/${tripId}/invitations`, {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      userId: inviteTarget.user.id
    }
  });

  assert.equal(addResponse.status, 409);
  assert.deepEqual(addResponse.body, {
    error: "Trip has already started; participants are locked"
  });
  assert.equal(inviteResponse.status, 409);
  assert.deepEqual(inviteResponse.body, {
    error: "Trip has already started; participants are locked"
  });
});

test("started trips cannot remove participants", async () => {
  const organizer = await registerUser({
    name: "StartedOwner",
    email: "started-owner@example.com"
  });
  const member = await registerUser({
    name: "StartedMember",
    email: "started-member@example.com"
  });
  const tripId = await createTrip(organizer.token);

  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(organizer.token),
    body: {
      userId: member.user.id
    }
  });
  await request(`/api/trips/${tripId}/start`, {
    method: "POST",
    headers: authHeaders(organizer.token)
  });

  const response = await request(
    `/api/trips/${tripId}/participants/${member.user.id}`,
    {
      method: "DELETE",
      headers: authHeaders(organizer.token)
    }
  );

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "Trip has already started; participants cannot be removed"
  });
});

test("started trips cannot remove organizer or members with expense history", async () => {
  const { token, user } = await loginAsDemoUser();
  const participant = await registerUser({
    name: "PaidMember",
    email: "paid-member@example.com"
  });
  const tripId = await createTrip(token);

  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      userId: participant.user.id
    }
  });
  await startTripForTest(token, tripId);
  await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Paid Dinner",
      amount: 120,
      category: "food",
      expenseType: "personal_advance",
      payerId: participant.user.id,
      includedParticipantIds: [user.id, participant.user.id]
    }
  });

  const removeOrganizerResponse = await request(
    `/api/trips/${tripId}/participants/${user.id}`,
    {
      method: "DELETE",
      headers: authHeaders(token)
    }
  );
  const removePayerResponse = await request(
    `/api/trips/${tripId}/participants/${participant.user.id}`,
    {
      method: "DELETE",
      headers: authHeaders(token)
    }
  );

  assert.equal(removeOrganizerResponse.status, 400);
  assert.deepEqual(removeOrganizerResponse.body, {
    error: "Organizer cannot be removed from the trip"
  });
  assert.equal(removePayerResponse.status, 409);
  assert.deepEqual(removePayerResponse.body, {
    error: "Trip has already started; participants cannot be removed"
  });
});

test("started trips cannot remove members with split expense history", async () => {
  const { token, user } = await loginAsDemoUser();
  const participant = await registerUser({
    name: "SplitHistoryMember",
    email: "split-history-member@example.com"
  });
  const tripId = await createTrip(token);

  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      userId: participant.user.id
    }
  });
  await startTripForTest(token, tripId);
  const expenseResponse = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Shared Dinner",
      amount: 90,
      category: "food",
      expenseType: "personal_advance",
      payerId: user.id,
      includedParticipantIds: [user.id, participant.user.id]
    }
  });
  const removeResponse = await request(
    `/api/trips/${tripId}/participants/${participant.user.id}`,
    {
      method: "DELETE",
      headers: authHeaders(token)
    }
  );

  assert.equal(expenseResponse.status, 201);
  assert.equal(removeResponse.status, 409);
  assert.deepEqual(removeResponse.body, {
    error: "Trip has already started; participants cannot be removed"
  });
});

test("organizer cannot add a duplicate approved participant", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Riley Duplicate",
      email: "riley-duplicate@example.com"
    }
  });

  const response = await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Riley Duplicate",
      email: "riley-duplicate@example.com"
    }
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "Participant already exists on this trip"
  });
});

test("regular participants cannot add participants or set budgets", async () => {
  const { token } = await loginAsDemoUser({
    email: "sam@example.com",
    password: "Demo-password1!"
  });
  const tripId = "trip_4";

  const addParticipantResponse = await request(
    `/api/trips/${tripId}/participants`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: {
        name: "Blocked Guest",
        email: "blocked@example.com"
      }
    }
  );
  const budgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      totalBudget: 1000
    }
  });

  assert.equal(addParticipantResponse.status, 403);
  assert.equal(budgetResponse.status, 403);
  assert.deepEqual(budgetResponse.body, {
    error: "Only an organizer can perform this action"
  });
});

test("organizer can set total and per-person budgets", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const totalBudgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      currencyCode: "CAD",
      totalBudget: 1200
    }
  });
  const perPersonBudgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "per-person",
      perPersonBudget: 400
    }
  });

  assert.equal(totalBudgetResponse.status, 200);
  assert.equal(totalBudgetResponse.body.budgetSummary.totalBudget, 1200);
  assert.equal(totalBudgetResponse.body.budgetSummary.perPersonBudget, null);
  assert.equal(totalBudgetResponse.body.budgetSummary.currencyCode, "CAD");
  assert.equal(perPersonBudgetResponse.status, 200);
  assert.equal(perPersonBudgetResponse.body.budgetSummary.totalBudget, 400);
  assert.equal(perPersonBudgetResponse.body.budgetSummary.perPersonBudget, 400);
  assert.equal(perPersonBudgetResponse.body.budgetSummary.currencyCode, "USD");
});

test("started trips can only increase the existing budget", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      totalBudget: 1000
    }
  });
  await request(`/api/trips/${tripId}/start`, {
    method: "POST",
    headers: authHeaders(token)
  });

  const decreaseResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      totalBudget: 900
    }
  });
  const modeChangeResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "per-person",
      perPersonBudget: 1200
    }
  });
  const increaseResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      totalBudget: 1200
    }
  });

  assert.equal(decreaseResponse.status, 409);
  assert.deepEqual(decreaseResponse.body, {
    error: "Trip has already started; budget can only be increased"
  });
  assert.equal(modeChangeResponse.status, 409);
  assert.deepEqual(modeChangeResponse.body, {
    error: "Trip has already started; budget mode cannot be changed"
  });
  assert.equal(increaseResponse.status, 200);
  assert.equal(increaseResponse.body.budgetSummary.totalBudget, 1200);
});

test("budget API rejects invalid budget input", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const response = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "weekly",
      totalBudget: 1200
    }
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "Invalid budget input"
  });
});

test("budget API rejects non-cent and non-finite amounts", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  for (const totalBudget of [1.234, 0.005, 0.004, "Infinity", "NaN", 0, -5]) {
    const response = await request(`/api/trips/${tripId}/budget`, {
      method: "POST",
      headers: authHeaders(token),
      body: {
        mode: "total",
        totalBudget
      }
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "Invalid budget input"
    });
  }
});

test("expense API creates equal shares and recalculates balances", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);
  const teammate = await registerUser({
    name: "Expense Teammate",
    email: "expense-teammate@example.com"
  });
  await request("/api/me", {
    method: "PATCH",
    headers: authHeaders(teammate.token),
    body: {
      displayName: "Expense Buddy",
      avatarUrl: ""
    }
  });
  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      userId: teammate.user.id
    }
  });
  await startTripForTest(token, tripId);

  const response = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Lunch",
      amount: 30,
      category: "food",
      expenseType: "personal_advance",
      currencyCode: "EUR",
      payerId: user.id,
      splitRule: "equal",
      includedParticipantIds: [teammate.user.id]
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.expense.currencyCode, "EUR");
  assert.deepEqual(response.body.expense.includedParticipantIds, [teammate.user.id]);
  assert.equal(response.body.expense.expenseShares[0].shareAmount, 15);
  assert.equal(response.body.balances[0].actualPaid, 30);
  assert.equal(response.body.balances[0].fairShare, 15);
  assert.equal(response.body.balances[0].netBalance, 15);
  assert.equal(response.body.balances[1].actualPaid, 0);
  assert.equal(response.body.balances[1].fairShare, 15);
  assert.equal(response.body.balances[1].netBalance, -15);

  const balancesResponse = await request(`/api/trips/${tripId}/balances`, {
    headers: authHeaders(token)
  });
  const teammateBalance = balancesResponse.body.balances.find(
    (balance) => balance.participantId === teammate.user.id
  );
  assert.equal(teammateBalance.participant.displayName, "Expense Buddy");
});

test("expense API defaults to USD currency and rejects unsupported currency codes", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);
  const teammate = await registerUser({
    name: "Currency Teammate",
    email: "currency-teammate@example.com"
  });
  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      userId: teammate.user.id
    }
  });
  await startTripForTest(token, tripId);

  const defaultCurrencyResponse = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Default Currency",
      amount: 20,
      category: "food",
      expenseType: "personal_advance",
      payerId: user.id,
      splitRule: "equal",
      includedParticipantIds: [teammate.user.id]
    }
  });
  const unsupportedCurrencyResponse = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Unsupported Currency",
      amount: 20,
      category: "food",
      expenseType: "personal_advance",
      currencyCode: "DOGE",
      payerId: user.id,
      splitRule: "equal",
      includedParticipantIds: [teammate.user.id]
    }
  });

  assert.equal(defaultCurrencyResponse.status, 201);
  assert.equal(defaultCurrencyResponse.body.expense.currencyCode, "USD");
  assert.equal(unsupportedCurrencyResponse.status, 400);
  assert.deepEqual(unsupportedCurrencyResponse.body, {
    error: "Unsupported expense currency"
  });
});

test("expense API rejects recording expenses before the trip starts", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const response = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Too Early",
      amount: 25,
      category: "food",
      expenseType: "budget_payment",
      payerId: user.id,
      splitRule: "equal",
      includedParticipantIds: [user.id]
    }
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "Start the trip before recording expenses"
  });
});

test("ending a trip locks budget and expense changes", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const budgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "per-person",
      perPersonBudget: 1000
    }
  });
  const startedTrip = await startTripForTest(token, tripId);
  const endResponse = await request(`/api/trips/${tripId}/end`, {
    method: "POST",
    headers: authHeaders(token)
  });
  const lockedBudgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "per-person",
      perPersonBudget: 1200
    }
  });
  const lockedExpenseResponse = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "After Trip",
      amount: 25,
      category: "food",
      expenseType: "budget_payment",
      payerId: user.id,
      splitRule: "equal",
      includedParticipantIds: [user.id]
    }
  });

  assert.equal(budgetResponse.status, 200);
  assert.equal(typeof startedTrip.startedAt, "string");
  assert.equal(endResponse.status, 200);
  assert.equal(typeof endResponse.body.trip.endedAt, "string");
  assert.equal(lockedBudgetResponse.status, 409);
  assert.deepEqual(lockedBudgetResponse.body, {
    error: "Trip has ended; budget is locked"
  });
  assert.equal(lockedExpenseResponse.status, 400);
  assert.deepEqual(lockedExpenseResponse.body, {
    error: "Trip has ended; expenses are locked"
  });
});

test("expense API creates budget-payment shares without personal reimbursement balances", async () => {
  const { token } = await loginAsDemoUser();

  const response = await request("/api/trips/trip_4/expenses", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Museum Tickets",
      amount: 99,
      category: "tickets",
      expenseType: "budget_payment",
      payerId: "user_1",
      splitRule: "equal",
      includedParticipantIds: ["user_1", "user_2", "user_3"]
    }
  });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.expense.expenseShares, [
    {
      participantId: "user_1",
      shareAmount: 33
    },
    {
      participantId: "user_2",
      shareAmount: 33
    },
    {
      participantId: "user_3",
      shareAmount: 33
    }
  ]);
  assert.equal(response.body.budgetSummary.totalSpent, 99);
  assert.deepEqual(
    response.body.balances.map((balance) => ({
      participantId: balance.participantId,
      budgetSpent: balance.budgetSpent,
      actualPaid: balance.actualPaid,
      fairShare: balance.fairShare,
      netBalance: balance.netBalance
    })),
    [
      {
        participantId: "user_1",
        budgetSpent: 33,
        actualPaid: 450,
        fairShare: 180,
        netBalance: 270
      },
      {
        participantId: "user_2",
        budgetSpent: 33,
        actualPaid: 90,
        fairShare: 180,
        netBalance: -90
      },
      {
        participantId: "user_3",
        budgetSpent: 33,
        actualPaid: 0,
        fairShare: 180,
        netBalance: -180
      }
    ]
  );
});

test("budget summary converts mixed-currency budget payments to the budget currency", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      totalBudget: 5000,
      currencyCode: "USD"
    }
  });
  await startTripForTest(token, tripId);

  const flight = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Flight",
      amount: 1000,
      category: "transportation",
      expenseType: "budget_payment",
      payerId: user.id,
      currencyCode: "USD",
      splitRule: "equal",
      includedParticipantIds: [user.id]
    }
  });
  const hotel = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Hotel",
      amount: 1000,
      category: "lodging",
      expenseType: "budget_payment",
      payerId: user.id,
      currencyCode: "JPY",
      splitRule: "equal",
      includedParticipantIds: [user.id]
    }
  });

  assert.equal(flight.status, 201);
  assert.equal(hotel.status, 201);
  assert.equal(hotel.body.budgetSummary.currencyCode, "USD");
  assert.equal(hotel.body.budgetSummary.totalSpent, 1006.37);
  assert.equal(hotel.body.budgetSummary.remainingBudget, 3993.63);
});

test("expense API distributes leftover cents so equal split balances are conserved", async () => {
  const { token } = await loginAsDemoUser();

  const response = await request("/api/trips/trip_4/expenses", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Theme Park Tickets",
      amount: 500,
      category: "tickets",
      expenseType: "personal_advance",
      payerId: "user_1",
      splitRule: "equal",
      includedParticipantIds: ["user_2", "user_3"]
    }
  });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.expense.expenseShares, [
    {
      participantId: "user_2",
      shareAmount: 166.67
    },
    {
      participantId: "user_3",
      shareAmount: 166.66
    }
  ]);
  assert.equal(
    response.body.expense.expenseShares.reduce((sum, share) => sum + share.shareAmount, 0),
    333.33
  );
  assert.equal(
    response.body.balances.reduce((sum, balance) => sum + balance.netBalance, 0),
    0
  );
});

test("expense API rejects expenses without explicit split participants", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);
  await startTripForTest(token, tripId);

  const missingSplitResponse = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Missing Split",
      amount: 20,
      category: "food",
      expenseType: "personal_advance",
      payerId: user.id,
      splitRule: "equal"
    }
  });
  const emptySplitResponse = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Empty Split",
      amount: 20,
      category: "food",
      expenseType: "personal_advance",
      payerId: user.id,
      splitRule: "equal",
      includedParticipantIds: []
    }
  });

  assert.equal(missingSplitResponse.status, 400);
  assert.deepEqual(missingSplitResponse.body, {
    error: "Choose at least one person who should reimburse the payer"
  });
  assert.equal(emptySplitResponse.status, 400);
  assert.deepEqual(emptySplitResponse.body, {
    error: "Choose at least one person who should reimburse the payer"
  });
});

test("expense API dedupes repeated split participants", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);
  const teammate = await registerUser({
    name: "Repeated Split Teammate",
    email: "repeated-split-teammate@example.com"
  });
  await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      userId: teammate.user.id
    }
  });
  await startTripForTest(token, tripId);

  const response = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Repeated Split",
      amount: 30,
      category: "food",
      expenseType: "personal_advance",
      payerId: user.id,
      splitRule: "equal",
      includedParticipantIds: [teammate.user.id, teammate.user.id]
    }
  });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.expense.includedParticipantIds, [teammate.user.id]);
  assert.deepEqual(response.body.expense.expenseShares, [
    {
      participantId: teammate.user.id,
      shareAmount: 15
    }
  ]);
});

test("expense API rejects non-cent and non-finite amounts", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);
  await startTripForTest(token, tripId);

  for (const amount of [1.234, 0.005, 0.004, "Infinity", "NaN", 0, -5]) {
    const response = await request(`/api/trips/${tripId}/expenses`, {
      method: "POST",
      headers: authHeaders(token),
      body: {
        title: "Invalid Amount",
        amount,
        category: "food",
        expenseType: "personal_advance",
        payerId: user.id,
        splitRule: "equal",
        includedParticipantIds: [user.id]
      }
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "Invalid expense input"
    });
  }
});

test("expense API splits personal advances without increasing budget spending", async () => {
  const { token } = await loginAsDemoUser();

  const response = await request("/api/trips/trip_4/expenses", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Shared Drinks",
      amount: 45,
      category: "drinks",
      expenseType: "personal_advance",
      payerId: "user_1",
      splitRule: "equal",
      includedParticipantIds: ["user_1", "user_2", "user_3"]
    }
  });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.expense.includedParticipantIds, [
    "user_2",
    "user_3"
  ]);
  assert.deepEqual(response.body.expense.expenseShares, [
    {
      participantId: "user_2",
      shareAmount: 15
    },
    {
      participantId: "user_3",
      shareAmount: 15
    }
  ]);
  assert.equal(response.body.budgetSummary.totalSpent, 0);
  assert.deepEqual(
    response.body.balances.map((balance) => ({
      participantId: balance.participantId,
      budgetSpent: balance.budgetSpent,
      actualPaid: balance.actualPaid,
      fairShare: balance.fairShare,
      netBalance: balance.netBalance
    })),
    [
      {
        participantId: "user_1",
        budgetSpent: 0,
        actualPaid: 495,
        fairShare: 195,
        netBalance: 300
      },
      {
        participantId: "user_2",
        budgetSpent: 0,
        actualPaid: 90,
        fairShare: 195,
        netBalance: -105
      },
      {
        participantId: "user_3",
        budgetSpent: 0,
        actualPaid: 0,
        fairShare: 195,
        netBalance: -195
      }
    ]
  );
});

test("expense API rejects payer who is not an approved trip participant", async () => {
  const { token } = await loginAsDemoUser();
  const outsider = await registerUser({
    name: "Payer Outsider",
    email: "payer-outsider@example.com"
  });

  const response = await request("/api/trips/trip_4/expenses", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Blocked Expense",
      amount: 24,
      category: "food",
      expenseType: "personal_advance",
      payerId: outsider.user.id,
      splitRule: "equal",
      includedParticipantIds: ["user_1"]
    }
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "Expense payer must be an approved trip participant"
  });
});

test("expense API rejects split participants who are not approved on the trip", async () => {
  const { token } = await loginAsDemoUser();
  const outsider = await registerUser({
    name: "Split Outsider",
    email: "split-outsider@example.com"
  });

  const response = await request("/api/trips/trip_4/expenses", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Blocked Split",
      amount: 24,
      category: "food",
      expenseType: "personal_advance",
      payerId: "user_1",
      splitRule: "equal",
      includedParticipantIds: ["user_1", outsider.user.id]
    }
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "Expense split participant must be an approved trip participant"
  });
});

test("balance API calculates participant totals from expenses and shares", async () => {
  const { token } = await loginAsDemoUser();

  const response = await request("/api/trips/trip_4/balances", {
    headers: authHeaders(token)
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.balances.map((balance) => ({
      participantId: balance.participantId,
      actualPaid: balance.actualPaid,
      fairShare: balance.fairShare,
      netBalance: balance.netBalance,
      participantName: balance.participant.name
    })),
    [
      {
        participantId: "user_1",
        actualPaid: 450,
        fairShare: 180,
        netBalance: 270,
        participantName: "Alex Organizer"
      },
      {
        participantId: "user_2",
        actualPaid: 90,
        fairShare: 180,
        netBalance: -90,
        participantName: "Sam Traveler"
      },
      {
        participantId: "user_3",
        actualPaid: 0,
        fairShare: 180,
        netBalance: -180,
        participantName: "Jordan Budgeter"
      }
    ]
  );
});

test("organizer can delete an expense and recalculate budget and balances", async () => {
  const { token } = await loginAsDemoUser();

  const response = await request("/api/trips/trip_4/expenses/expense_5", {
    method: "DELETE",
    headers: authHeaders(token)
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.deletedExpenseId, "expense_5");
  assert.equal(response.body.deletedExpense.deletedAt !== null, true);
  assert.equal(
    response.body.auditLogs.some((entry) => entry.action === "expense.deleted"),
    true
  );
  assert.equal(response.body.budgetSummary.totalSpent, 0);
  assert.equal(response.body.budgetSummary.remainingBudget, 900);
  assert.deepEqual(
    response.body.balances.map((balance) => ({
      participantId: balance.participantId,
      actualPaid: balance.actualPaid,
      fairShare: balance.fairShare,
      netBalance: balance.netBalance
    })),
    [
      {
        participantId: "user_1",
        actualPaid: 0,
        fairShare: 30,
        netBalance: -30
      },
      {
        participantId: "user_2",
        actualPaid: 90,
        fairShare: 30,
        netBalance: 60
      },
      {
        participantId: "user_3",
        actualPaid: 0,
        fairShare: 30,
        netBalance: -30
      }
    ]
  );
});

test("soft-deleted expenses are hidden from trip detail and can be restored by organizer", async () => {
  const { token } = await loginAsDemoUser();
  const { tripId, expenseId } = await createStartedTripWithExpense(token, {
    expenseType: "budget_payment",
    amount: 450
  });

  const deleteResponse = await request(`/api/trips/${tripId}/expenses/${expenseId}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  const detailAfterDelete = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(token)
  });
  const restoreResponse = await request(`/api/trips/${tripId}/expenses/${expenseId}/restore`, {
    method: "POST",
    headers: authHeaders(token)
  });
  const detailAfterRestore = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(token)
  });

  assert.equal(deleteResponse.status, 200);
  assert.equal(
    detailAfterDelete.body.trip.expenses.some((expense) => expense.id === expenseId),
    false
  );
  assert.equal(
    detailAfterDelete.body.trip.deletedExpenses.some((expense) => expense.id === expenseId),
    true
  );
  assert.equal(detailAfterDelete.body.trip.budgetSummary.totalSpent, 0);
  assert.equal(restoreResponse.status, 200);
  assert.equal(restoreResponse.body.restoredExpenseId, expenseId);
  assert.equal(restoreResponse.body.restoredExpense.deletedAt, null);
  assert.equal(
    restoreResponse.body.auditLogs.some((entry) => entry.action === "expense.restored"),
    true
  );
  assert.equal(
    detailAfterRestore.body.trip.expenses.some((expense) => expense.id === expenseId),
    true
  );
  assert.equal(detailAfterRestore.body.trip.deletedExpenses.length, 0);
  assert.equal(detailAfterRestore.body.trip.budgetSummary.totalSpent, 450);
});

test("organizer can delete another payer's expense", async () => {
  const organizer = await loginAsDemoUser();
  const payer = await loginAsDemoUser({
    email: "sam@example.com",
    password: "Demo-password1!"
  });
  const { tripId, expenseId } = await createStartedTripWithExpense(organizer.token, {
    payerId: payer.user.id,
    expenseType: "personal_advance"
  });

  const response = await request(`/api/trips/${tripId}/expenses/${expenseId}`, {
    method: "DELETE",
    headers: authHeaders(organizer.token)
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.deletedExpenseId, expenseId);
});

test("expense payer can delete their own expense", async () => {
  const organizer = await loginAsDemoUser();
  const payer = await loginAsDemoUser({
    email: "sam@example.com",
    password: "Demo-password1!"
  });
  const { tripId, expenseId } = await createStartedTripWithExpense(organizer.token, {
    payerId: payer.user.id,
    expenseType: "personal_advance"
  });

  const response = await request(`/api/trips/${tripId}/expenses/${expenseId}`, {
    method: "DELETE",
    headers: authHeaders(payer.token)
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.deletedExpenseId, expenseId);
  assert.equal(
    response.body.auditLogs.some((entry) => entry.action === "expense.deleted"),
    true
  );
});

test("regular participants cannot delete another participant's expense", async () => {
  const { token } = await loginAsDemoUser({
    email: "jordan@example.com",
    password: "Demo-password1!"
  });

  const response = await request("/api/trips/trip_4/expenses/expense_5", {
    method: "DELETE",
    headers: authHeaders(token)
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    error: "Only the expense payer or trip organizer can delete this expense"
  });
});

test("non-participants cannot delete trip expenses", async () => {
  const outsider = await registerUser({
    name: "Expense Outsider",
    email: "expense-outsider@example.com"
  });

  const response = await request("/api/trips/trip_4/expenses/expense_5", {
    method: "DELETE",
    headers: authHeaders(outsider.token)
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    error: "You are not an approved participant on this trip"
  });
});

test("ended trips block expense deletion for organizer and payer", async () => {
  const organizer = await loginAsDemoUser();
  const payer = await loginAsDemoUser({
    email: "sam@example.com",
    password: "Demo-password1!"
  });

  const endResponse = await request("/api/trips/trip_4/end", {
    method: "POST",
    headers: authHeaders(organizer.token)
  });
  const organizerDeleteResponse = await request("/api/trips/trip_4/expenses/expense_5", {
    method: "DELETE",
    headers: authHeaders(organizer.token)
  });
  const payerDeleteResponse = await request("/api/trips/trip_4/expenses/expense_6", {
    method: "DELETE",
    headers: authHeaders(payer.token)
  });

  assert.equal(endResponse.status, 200);
  assert.equal(organizerDeleteResponse.status, 400);
  assert.deepEqual(organizerDeleteResponse.body, {
    error: "Trip has ended; expenses are locked"
  });
  assert.equal(payerDeleteResponse.status, 400);
  assert.deepEqual(payerDeleteResponse.body, {
    error: "Trip has ended; expenses are locked"
  });
});

test("ended trips block expense restore", async () => {
  const { token } = await loginAsDemoUser();
  const { tripId, expenseId } = await createStartedTripWithExpense(token, {
    expenseType: "budget_payment"
  });

  const deleteResponse = await request(`/api/trips/${tripId}/expenses/${expenseId}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  await request(`/api/trips/${tripId}/end`, {
    method: "POST",
    headers: authHeaders(token)
  });
  const restoreResponse = await request(`/api/trips/${tripId}/expenses/${expenseId}/restore`, {
    method: "POST",
    headers: authHeaders(token)
  });

  assert.equal(deleteResponse.status, 200);
  assert.equal(restoreResponse.status, 400);
  assert.deepEqual(restoreResponse.body, {
    error: "Trip has ended; expenses are locked"
  });
});

async function loginAsDemoUser({
  email = "alex@example.com",
  password = "Demo-password1!"
} = {}) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: {
      email,
      password
    }
  });

  assert.equal(response.status, 200);
  return response.body;
}

async function registerUser({
  name,
  email,
  password = "Demo-password1!"
}) {
  await startRegistration({ name, email, password });

  const response = await request("/api/auth/register/verify", {
    method: "POST",
    body: {
      email,
      code: getLastRegistrationVerificationCode(email)
    }
  });

  assert.equal(response.status, 201);
  return response.body;
}

async function startRegistration({
  name,
  email,
  password = "Demo-password1!"
}) {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name,
      email,
      password
    }
  });

  assert.equal(response.status, 202);
  return response.body;
}

async function createTrip(token) {
  const response = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "API Test Trip"
    }
  });

  assert.equal(response.status, 201);
  return response.body.trip.id;
}

async function createStartedTripWithExpense(token, {
  payerId,
  expenseType = "personal_advance",
  amount = 90
} = {}) {
  const tripId = await createTrip(token);
  const organizer = await request("/api/me", {
    headers: authHeaders(token)
  });
  const organizerId = organizer.body.user.id;
  const finalPayerId = payerId || organizerId;

  if (finalPayerId !== organizerId) {
    const participantResponse = await request(`/api/trips/${tripId}/participants`, {
      method: "POST",
      headers: authHeaders(token),
      body: {
        userId: finalPayerId
      }
    });
    assert.equal(participantResponse.status, 200);
  }

  if (expenseType === "budget_payment") {
    const budgetResponse = await request(`/api/trips/${tripId}/budget`, {
      method: "POST",
      headers: authHeaders(token),
      body: {
        mode: "total",
        totalBudget: 1000
      }
    });
    assert.equal(budgetResponse.status, 200);
  }

  await startTripForTest(token, tripId);
  const expenseResponse = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Permission Matrix Expense",
      amount,
      category: "food",
      expenseType,
      payerId: finalPayerId,
      includedParticipantIds: expenseType === "budget_payment"
        ? [organizerId]
        : [organizerId]
    }
  });

  assert.equal(expenseResponse.status, 201);
  return {
    tripId,
    expenseId: expenseResponse.body.expense.id
  };
}

async function startTripForTest(token, tripId) {
  const response = await request(`/api/trips/${tripId}/start`, {
    method: "POST",
    headers: authHeaders(token)
  });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.trip.startedAt, "string");
  return response.body.trip;
}

function signTestToken(payload) {
  const encodedHeader = base64UrlJson({
    alg: "HS256",
    typ: "JWT"
  });
  const encodedPayload = base64UrlJson(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac(
    "sha256",
    process.env.JWT_SECRET || "tripsplit-local-development-secret"
  )
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
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
    res.writeHead = (statusCode, headersToWrite = {}) => {
      res.statusCode = statusCode;
      for (const [name, value] of Object.entries(headersToWrite)) {
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
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
  );
}
