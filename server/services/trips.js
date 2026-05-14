import {
  addParticipant,
  createTrip,
  createUser,
  findUserByEmail,
  findUserById,
  getTripById,
  getTripRecord,
  isApprovedParticipant,
  isOrganizer,
  isValidBudgetInput,
  listTripSummariesForUser,
  setBudget
} from "../store.js";
import { hashPassword } from "./auth.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import { requireFields } from "../validators/request.js";

export function listTripsForUser(userId) {
  return {
    trips: listTripSummariesForUser(userId)
  };
}

export function createTripForUser(userId, input = {}) {
  requireFields(input, ["name"]);

  return {
    trip: createTrip({
      name: input.name,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      organizerId: userId
    })
  };
}

export function getTripForUser(userId, tripId) {
  ensureApprovedParticipant(userId, tripId);

  return {
    trip: getTripById(tripId)
  };
}

export function addParticipantToTrip(userId, tripId, input = {}) {
  ensureOrganizer(userId, tripId);

  const participantUser = resolveParticipantUser(input);
  const trip = getTripRecord(tripId);

  if (
    trip.participants.some(
      (participant) =>
        participant.userId === participantUser.id &&
        participant.joinStatus === "approved"
    )
  ) {
    throw conflict("Participant already exists on this trip");
  }

  return {
    trip: addParticipant(tripId, {
      userId: participantUser.id,
      role: input.role || "participant"
    })
  };
}

export function setTripBudget(userId, tripId, input = {}) {
  ensureOrganizer(userId, tripId);

  if (!isValidBudgetInput(input)) {
    throw badRequest("Invalid budget input");
  }

  return {
    tripId,
    budgetSummary: setBudget(tripId, input)
  };
}

export function ensureApprovedParticipant(userId, tripId) {
  const trip = getTripRecord(tripId);

  if (!trip) {
    throw notFound("Trip not found");
  }

  if (!isApprovedParticipant(tripId, userId)) {
    throw forbidden("You are not an approved participant on this trip");
  }

  return trip;
}

export function ensureOrganizer(userId, tripId) {
  ensureApprovedParticipant(userId, tripId);

  if (!isOrganizer(tripId, userId)) {
    throw forbidden("Only an organizer can perform this action");
  }
}

function resolveParticipantUser(input) {
  if (input.userId) {
    const user = findUserById(input.userId);

    if (!user) {
      throw notFound("User not found");
    }

    return user;
  }

  requireFields(input, ["name", "email"]);

  const existingUser = findUserByEmail(input.email);
  if (existingUser) {
    return existingUser;
  }

  return createUser({
    name: input.name,
    email: input.email,
    passwordHash: hashPassword("invited-user")
  });
}
