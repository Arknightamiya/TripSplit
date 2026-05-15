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
import {
  createTripRecord,
  findTripRecordById,
  isTripRepositoryEnabled,
  listTripSummaryRecordsForUser,
  tripRecordExists,
  userIsApprovedParticipantRecord,
  userIsOrganizerRecord
} from "../repositories/trips.js";
import { hashPassword } from "./auth.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import { requireFields } from "../validators/request.js";

export async function listTripsForUser(userId) {
  if (isTripRepositoryEnabled()) {
    return {
      trips: await listTripSummaryRecordsForUser(userId)
    };
  }

  return {
    trips: listTripSummariesForUser(userId)
  };
}

export async function createTripForUser(userId, input = {}) {
  requireFields(input, ["name"]);

  if (isTripRepositoryEnabled()) {
    return {
      trip: await createTripRecord({
        name: input.name,
        destination: input.destination,
        startDate: input.startDate,
        endDate: input.endDate,
        organizerId: userId
      })
    };
  }

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

export async function getTripForUser(userId, tripId) {
  await ensureApprovedParticipant(userId, tripId);

  return {
    trip: isTripRepositoryEnabled()
      ? await findTripRecordById(tripId)
      : getTripById(tripId)
  };
}

export async function addParticipantToTrip(userId, tripId, input = {}) {
  await ensureOrganizer(userId, tripId);

  if (isTripRepositoryEnabled()) {
    throw badRequest("PostgreSQL participant management is not implemented yet");
  }

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

export async function setTripBudget(userId, tripId, input = {}) {
  await ensureOrganizer(userId, tripId);

  if (isTripRepositoryEnabled()) {
    throw badRequest("PostgreSQL budget persistence is not implemented yet");
  }

  if (!isValidBudgetInput(input)) {
    throw badRequest("Invalid budget input");
  }

  return {
    tripId,
    budgetSummary: setBudget(tripId, input)
  };
}

export async function ensureApprovedParticipant(userId, tripId) {
  if (isTripRepositoryEnabled()) {
    if (!(await tripRecordExists(tripId))) {
      throw notFound("Trip not found");
    }

    if (!(await userIsApprovedParticipantRecord(userId, tripId))) {
      throw forbidden("You are not an approved participant on this trip");
    }

    return findTripRecordById(tripId);
  }

  const trip = getTripRecord(tripId);

  if (!trip) {
    throw notFound("Trip not found");
  }

  if (!isApprovedParticipant(tripId, userId)) {
    throw forbidden("You are not an approved participant on this trip");
  }

  return trip;
}

export async function ensureOrganizer(userId, tripId) {
  await ensureApprovedParticipant(userId, tripId);

  if (isTripRepositoryEnabled()) {
    if (!(await userIsOrganizerRecord(userId, tripId))) {
      throw forbidden("Only an organizer can perform this action");
    }

    return;
  }

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
