import {
  areFriends,
  createFriendRequest,
  createTripJoinRequest,
  findPendingFriendRequestBetween,
  findPendingTripJoinRequest,
  findUserByEmail,
  findUserById,
  findUserByName,
  getTripRecord,
  isApprovedParticipant,
  listFriendsForUser,
  listIncomingFriendRequests,
  listIncomingTripInvitations,
  listIncomingTripJoinRequests,
  listOutgoingFriendRequests,
  listPublicTripsForFriend,
  removeFriendship,
  respondToFriendRequest,
  respondToTripInvitation,
  respondToTripJoinRequest,
  searchUsers
} from "../store.js";
import {
  createFriendRequestRecord,
  createTripJoinRequestRecord,
  findPendingFriendRequestRecordBetween,
  findPendingTripJoinRequestRecord,
  isFriendRepositoryEnabled,
  listFriendRecords,
  listIncomingFriendRequestRecords,
  listIncomingTripInvitationRecords,
  listIncomingTripJoinRequestRecords,
  listOutgoingFriendRequestRecords,
  listPublicTripRecordsForFriend,
  removeFriendshipRecord,
  respondToFriendRequestRecord,
  respondToTripInvitationRecord,
  respondToTripJoinRequestRecord,
  searchUserRecords,
  usersAreFriendsRecord
} from "../repositories/friends.js";
import {
  findUserRecordByEmail,
  findUserRecordById,
  findUserRecordByName
} from "../repositories/users.js";
import {
  findTripRecordById,
  isTripRepositoryEnabled,
  userIsApprovedParticipantRecord
} from "../repositories/trips.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";

const FRIEND_REQUEST_STATUSES = ["accepted", "declined"];

export async function getFriendsOverview(userId) {
  if (isFriendRepositoryEnabled()) {
    const [
      friends,
      incomingRequests,
      outgoingRequests,
      tripJoinRequests,
      tripInvitations
    ] =
      await Promise.all([
        listFriendRecords(userId),
        listIncomingFriendRequestRecords(userId),
        listOutgoingFriendRequestRecords(userId),
        listIncomingTripJoinRequestRecords(userId),
        listIncomingTripInvitationRecords(userId)
      ]);

    return {
      friends,
      incomingRequests,
      outgoingRequests,
      tripJoinRequests,
      tripInvitations
    };
  }

  return {
    friends: listFriendsForUser(userId),
    incomingRequests: listIncomingFriendRequests(userId),
    outgoingRequests: listOutgoingFriendRequests(userId),
    tripJoinRequests: listIncomingTripJoinRequests(userId),
    tripInvitations: listIncomingTripInvitations(userId)
  };
}

export async function searchFriends(userId, query) {
  const normalizedQuery = String(query || "").trim();

  if (!normalizedQuery) {
    return { users: [] };
  }

  return {
    users: isFriendRepositoryEnabled()
      ? await searchUserRecords(normalizedQuery, userId)
      : searchUsers(normalizedQuery, userId)
  };
}

export async function sendFriendRequest(userId, input = {}) {
  const target = await resolveUserIdentifier(input.identifier ?? input.userId);

  if (!target) {
    throw notFound("User not found");
  }

  if (String(target.id) === String(userId)) {
    throw badRequest("You cannot add yourself as a friend");
  }

  if (await usersAreFriends(userId, target.id)) {
    throw conflict("This user is already your friend");
  }

  const pendingRequest = await findPendingFriendRequest(userId, target.id);
  if (pendingRequest) {
    throw conflict("A friend request already exists between these users");
  }

  return {
    request: isFriendRepositoryEnabled()
      ? await createFriendRequestRecord({
        requesterId: userId,
        recipientId: target.id
      })
      : createFriendRequest({
        requesterId: userId,
        recipientId: target.id
      })
  };
}

export async function respondToIncomingFriendRequest(userId, requestId, status) {
  if (!FRIEND_REQUEST_STATUSES.includes(status)) {
    throw badRequest("Invalid friend request action");
  }

  const request = isFriendRepositoryEnabled()
    ? await respondToFriendRequestRecord(requestId, userId, status)
    : respondToFriendRequest(requestId, userId, status);

  if (!request) {
    throw notFound("Friend request not found");
  }

  return { request };
}

export async function removeFriend(userId, friendId) {
  if (!(await usersAreFriends(userId, friendId))) {
    throw notFound("Friend not found");
  }

  const removed = isFriendRepositoryEnabled()
    ? await removeFriendshipRecord(userId, friendId)
    : removeFriendship(userId, friendId);

  return { removed };
}

export async function getFriendProfile(userId, friendId) {
  const friend = await findUserByStableId(friendId);

  if (!friend || !(await usersAreFriends(userId, friend.id))) {
    throw notFound("Friend not found");
  }

  return {
    friend,
    publicTrips: isFriendRepositoryEnabled()
      ? await listPublicTripRecordsForFriend(userId, friend.id)
      : listPublicTripsForFriend(userId, friend.id)
  };
}

export async function requestToJoinPublicTrip(userId, tripId) {
  const trip = await findTripByStableId(tripId);

  if (!trip) {
    throw notFound("Trip not found");
  }

  if (trip.visibility !== "public") {
    throw forbidden("This trip is private");
  }

  if (
    !(await usersAreFriends(userId, trip.organizerId)) ||
    !(await usersAreFriends(trip.organizerId, userId))
  ) {
    throw forbidden("Only friends can request to join this trip");
  }

  if (await userIsApprovedParticipant(userId, tripId)) {
    throw conflict("You are already a participant on this trip");
  }

  if (await findPendingTripJoinRequestForUser(tripId, userId)) {
    throw conflict("A join request already exists for this trip");
  }

  return {
    request: isFriendRepositoryEnabled()
      ? await createTripJoinRequestRecord({ tripId, requesterId: userId })
      : createTripJoinRequest({ tripId, requesterId: userId })
  };
}

export async function respondToIncomingTripJoinRequest(userId, requestId, status) {
  if (!FRIEND_REQUEST_STATUSES.includes(status)) {
    throw badRequest("Invalid trip join request action");
  }

  const request = isFriendRepositoryEnabled()
    ? await respondToTripJoinRequestRecord(requestId, userId, status)
    : respondToTripJoinRequest(requestId, userId, status);

  if (!request) {
    throw notFound("Trip join request not found");
  }

  return { request };
}

export async function respondToIncomingTripInvitation(userId, tripId, status) {
  if (!FRIEND_REQUEST_STATUSES.includes(status)) {
    throw badRequest("Invalid trip invitation action");
  }

  const invitation = isFriendRepositoryEnabled()
    ? await respondToTripInvitationRecord(userId, tripId, status)
    : respondToTripInvitation(tripId, userId, status);

  if (!invitation) {
    throw notFound("Trip invitation not found");
  }

  return { invitation };
}

async function resolveUserIdentifier(identifier) {
  const normalizedIdentifier = String(identifier || "").trim();

  if (!normalizedIdentifier) {
    throw badRequest("Missing required field: identifier");
  }

  if (isFriendRepositoryEnabled()) {
    if (/^\d+$/.test(normalizedIdentifier)) {
      const byId = await findUserRecordById(normalizedIdentifier);
      if (byId) return byId;
    }

    return normalizedIdentifier.includes("@")
      ? findUserRecordByEmail(normalizedIdentifier)
      : findUserRecordByName(normalizedIdentifier);
  }

  if (normalizedIdentifier.startsWith("user_")) {
    const byId = findUserById(normalizedIdentifier);
    if (byId) return byId;
  }

  return normalizedIdentifier.includes("@")
    ? findUserByEmail(normalizedIdentifier)
    : findUserByName(normalizedIdentifier);
}

async function findUserByStableId(userId) {
  if (isFriendRepositoryEnabled()) {
    return findUserRecordById(userId);
  }

  return findUserById(userId);
}

async function findTripByStableId(tripId) {
  if (isTripRepositoryEnabled()) {
    return findTripRecordById(tripId);
  }

  return getTripRecord(tripId);
}

async function usersAreFriends(userId, friendId) {
  return isFriendRepositoryEnabled()
    ? usersAreFriendsRecord(userId, friendId)
    : areFriends(userId, friendId);
}

async function findPendingFriendRequest(userId, friendId) {
  return isFriendRepositoryEnabled()
    ? findPendingFriendRequestRecordBetween(userId, friendId)
    : findPendingFriendRequestBetween(userId, friendId);
}

async function userIsApprovedParticipant(userId, tripId) {
  return isTripRepositoryEnabled()
    ? userIsApprovedParticipantRecord(userId, tripId)
    : isApprovedParticipant(tripId, userId);
}

async function findPendingTripJoinRequestForUser(tripId, userId) {
  return isFriendRepositoryEnabled()
    ? findPendingTripJoinRequestRecord(tripId, userId)
    : findPendingTripJoinRequest(tripId, userId);
}
