import {
  addParticipant,
  createTrip,
  createUser,
  deleteTrip,
  findUserByEmail,
  findUserById,
  findTripParticipant,
  getTripById,
  getTripRecord,
  inviteParticipant,
  isApprovedParticipant,
  isOrganizer,
  isValidBudgetInput,
  listTripSummariesForUser,
  removeTripParticipant,
  setBudget,
  updateTrip
} from "../store.js";
import {
  createTripRecord,
  addParticipantRecord,
  deleteTripRecord,
  findTripParticipantRecord,
  findTripRecordById,
  inviteParticipantRecord,
  isTripRepositoryEnabled,
  listTripSummaryRecordsForUser,
  removeParticipantRecord,
  setBudgetRecord,
  tripRecordExists,
  updateTripRecord,
  userIsApprovedParticipantRecord,
  userIsOrganizerRecord
} from "../repositories/trips.js";
import {
  createUserRecord,
  findUserRecordByEmail,
  findUserRecordById
} from "../repositories/users.js";
import { hashPassword } from "./auth.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import { requireFields } from "../validators/request.js";

const PARTICIPANT_ROLES = ["organizer", "participant"];

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
  const normalizedInput = normalizeTripInput(input);

  if (isTripRepositoryEnabled()) {
    return {
      trip: await createTripRecord({
        ...normalizedInput,
        organizerId: userId
      })
    };
  }

  return {
    trip: createTrip({
      ...normalizedInput,
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

export async function deleteTripForUser(userId, tripId) {
  await ensureOrganizer(userId, tripId);

  const deletedTrip = isTripRepositoryEnabled()
    ? await deleteTripRecord(tripId)
    : deleteTrip(tripId);

  if (!deletedTrip) {
    throw notFound("Trip not found");
  }

  return {
    deletedTripId: String(deletedTrip.id)
  };
}

export async function updateTripForUser(userId, tripId, input = {}) {
  await ensureOrganizer(userId, tripId);
  const normalizedInput = normalizeTripInput(input);

  const trip = isTripRepositoryEnabled()
    ? await updateTripRecord(tripId, normalizedInput)
    : updateTrip(tripId, normalizedInput);

  if (!trip) {
    throw notFound("Trip not found");
  }

  return { trip };
}

export async function addParticipantToTrip(userId, tripId, input = {}) {
  await ensureOrganizer(userId, tripId);
  const role = normalizeParticipantRole(input.role);

  if (isTripRepositoryEnabled()) {
    const participantUser = await resolveParticipantUserRecord(input);

    if (await userIsApprovedParticipantRecord(participantUser.id, tripId)) {
      throw conflict("Participant already exists on this trip");
    }

    return {
      trip: await addParticipantRecord(tripId, {
        userId: participantUser.id,
        role
      })
    };
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
      role
    })
  };
}

export async function inviteParticipantToTrip(userId, tripId, input = {}) {
  await ensureOrganizer(userId, tripId);
  const role = normalizeParticipantRole(input.role);

  if (isTripRepositoryEnabled()) {
    const participantUser = await resolveParticipantUserRecord(input);
    const existingParticipant = await findTripParticipantRecord(tripId, participantUser.id);

    if (existingParticipant?.joinStatus === "approved") {
      throw conflict("Participant already exists on this trip");
    }

    if (existingParticipant?.joinStatus === "pending") {
      throw conflict("Invitation already pending");
    }

    return {
      trip: await inviteParticipantRecord(tripId, {
        userId: participantUser.id,
        role
      })
    };
  }

  const participantUser = resolveParticipantUser(input);
  const existingParticipant = findTripParticipant(tripId, participantUser.id);

  if (existingParticipant?.joinStatus === "approved") {
    throw conflict("Participant already exists on this trip");
  }

  if (existingParticipant?.joinStatus === "pending") {
    throw conflict("Invitation already pending");
  }

  return {
    trip: inviteParticipant(tripId, {
      userId: participantUser.id,
      role
    })
  };
}

export async function removeParticipantFromTrip(userId, tripId, participantId) {
  await ensureOrganizer(userId, tripId);

  const trip = isTripRepositoryEnabled()
    ? await findTripRecordById(tripId)
    : getTripById(tripId);

  if (!trip) {
    throw notFound("Trip not found");
  }

  const participant = (trip.participants || []).find(
    (entry) => String(entry.id) === String(participantId)
  );

  if (!participant) {
    throw notFound("Participant not found");
  }

  if (participant.role === "organizer") {
    throw badRequest("Organizer cannot be removed from the trip");
  }

  if (
    participant.joinStatus === "approved" &&
    (trip.expenses || []).some((expense) => String(expense.payerId) === String(participantId))
  ) {
    throw conflict("Cannot remove a participant who paid expenses");
  }

  const updatedTrip = isTripRepositoryEnabled()
    ? await removeParticipantRecord(tripId, participantId)
    : removeTripParticipant(tripId, participantId);

  if (!updatedTrip) {
    throw notFound("Participant not found");
  }

  return {
    removedParticipantId: String(participantId),
    trip: updatedTrip
  };
}

export async function setTripBudget(userId, tripId, input = {}) {
  await ensureOrganizer(userId, tripId);

  if (!isValidBudgetInput(input)) {
    throw badRequest("Invalid budget input");
  }

  if (isTripRepositoryEnabled()) {
    return {
      tripId,
      budgetSummary: await setBudgetRecord(tripId, input)
    };
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

async function resolveParticipantUserRecord(input) {
  if (input.userId) {
    const user = await findUserRecordById(input.userId);

    if (!user) {
      throw notFound("User not found");
    }

    return user;
  }

  requireFields(input, ["name", "email"]);

  const existingUser = await findUserRecordByEmail(input.email);
  if (existingUser) {
    return existingUser;
  }

  return createUserRecord({
    name: input.name,
    email: input.email,
    passwordHash: hashPassword("invited-user")
  });
}

function normalizeParticipantRole(role = "participant") {
  if (!PARTICIPANT_ROLES.includes(role)) {
    throw badRequest("Invalid participant role");
  }

  return role;
}

function normalizeTripVisibility(visibility = "private") {
  return visibility === "public" ? "public" : "private";
}

function normalizeTripInput(input = {}) {
  const name = String(input.name ?? input.destination ?? "").trim();
  const destination = String(input.destination ?? input.name ?? "").trim();
  const startDate = input.startDate || null;
  const endDate = input.endDate || null;

  if (!name) {
    throw badRequest("Destination is required");
  }

  if (startDate && endDate && endDate < startDate) {
    throw badRequest("End date must be after start date");
  }

  return {
    name,
    destination: destination || name,
    startDate,
    endDate,
    visibility: normalizeTripVisibility(input.visibility)
  };
}
