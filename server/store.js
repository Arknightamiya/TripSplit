import { calculateBalances } from "./settlement.js";

const state = {
  nextId: 1,
  users: [],
  trips: []
};

function createId(prefix) {
  const id = `${prefix}_${state.nextId}`;
  state.nextId += 1;
  return id;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function seedStore() {
  if (state.users.length || state.trips.length) {
    return;
  }

  const organizer = createUser({
    name: "Alex Organizer",
    email: "alex@example.com",
    password: "demo-password"
  });
  const sam = createUser({
    name: "Sam Traveler",
    email: "sam@example.com",
    password: "demo-password"
  });
  const jordan = createUser({
    name: "Jordan Budgeter",
    email: "jordan@example.com",
    password: "demo-password"
  });

  const trip = createTrip({
    name: "San Diego Weekend",
    destination: "San Diego",
    startDate: "2026-06-05",
    endDate: "2026-06-07",
    organizerId: organizer.id
  });

  addParticipant(trip.id, { userId: sam.id });
  addParticipant(trip.id, { userId: jordan.id });
  const hydratedTrip = getTripById(trip.id);

  setBudget(trip.id, { mode: "total", amount: 900 });

  addExpense(trip.id, {
    title: "Hotel",
    amount: 450,
    category: "lodging",
    type: "shared",
    payerId: organizer.id,
    includedParticipantIds: hydratedTrip.participantIds
  });

  addExpense(trip.id, {
    title: "Dinner",
    amount: 90,
    category: "food",
    type: "shared",
    payerId: sam.id,
    includedParticipantIds: hydratedTrip.participantIds
  });
}

export function createUser({ name, email, password }) {
  const user = {
    id: createId("user"),
    name,
    email,
    password
  };

  state.users.push(user);
  return clone(user);
}

export function authenticateUser({ email, password }) {
  const user = state.users.find((entry) => entry.email === email && entry.password === password);
  return user ? clone(user) : null;
}

export function listTrips() {
  return state.trips.map((trip) => ({
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    participantCount: trip.participantIds.length,
    expenseCount: trip.expenses.length,
    budget: clone(trip.budget)
  }));
}

export function createTrip({ name, destination, startDate, endDate, organizerId }) {
  const finalName = name?.trim() || "Untitled Trip";
  const finalDestination = destination?.trim() || "TBD";
  const finalStartDate = startDate || null;
  const finalEndDate = endDate || null;
  const finalOrganizerId = organizerId || state.users[0]?.id || createUser({
    name: "Default Organizer",
    email: "organizer@example.com",
    password: "demo-password"
  }).id;

  const trip = {
    id: createId("trip"),
    name: finalName,
    destination: finalDestination,
    startDate: finalStartDate,
    endDate: finalEndDate,
    organizerId: finalOrganizerId,
    participantIds: [finalOrganizerId],
    budget: null,
    expenses: []
  };

  state.trips.push(trip);
  return clone(trip);
}

export function addParticipant(tripId, { userId, name, email }) {
  const trip = state.trips.find((entry) => entry.id === tripId);
  if (!trip) {
    return null;
  }

  let participantId = userId;

  if (!participantId) {
    const user = createUser({
      name,
      email,
      password: "invited-user"
    });
    participantId = user.id;
  }

  if (!trip.participantIds.includes(participantId)) {
    trip.participantIds.push(participantId);
  }

  return getTripById(tripId);
}

export function getTripById(tripId) {
  const trip = state.trips.find((entry) => entry.id === tripId);
  if (!trip) {
    return null;
  }

  return hydrateTrip(trip);
}

export function setBudget(tripId, budget) {
  const trip = state.trips.find((entry) => entry.id === tripId);
  if (!trip) {
    return null;
  }

  trip.budget = {
    mode: budget.mode,
    amount: Number(budget.amount)
  };

  return getTripById(tripId);
}

export function addExpense(tripId, expenseInput) {
  const trip = state.trips.find((entry) => entry.id === tripId);
  if (!trip) {
    return null;
  }

  const expense = {
    id: createId("expense"),
    title: expenseInput.title,
    amount: Number(expenseInput.amount),
    category: expenseInput.category,
    type: expenseInput.type,
    payerId: expenseInput.payerId,
    includedParticipantIds: expenseInput.includedParticipantIds,
    createdAt: new Date().toISOString()
  };

  trip.expenses.push(expense);
  return getTripById(tripId);
}

export function deleteExpense(tripId, expenseId) {
  const trip = state.trips.find((entry) => entry.id === tripId);
  if (!trip) {
    return null;
  }

  const nextExpenses = trip.expenses.filter((expense) => expense.id !== expenseId);
  const deleted = nextExpenses.length !== trip.expenses.length;
  trip.expenses = nextExpenses;

  return deleted ? getTripById(tripId) : false;
}

export function getBalances(tripId) {
  const trip = state.trips.find((entry) => entry.id === tripId);
  if (!trip) {
    return null;
  }

  const hydratedTrip = hydrateTrip(trip);
  const balances = calculateBalances(trip).map((entry) => ({
    ...entry,
    participant: hydratedTrip.participants.find((participant) => participant.id === entry.participantId)
  }));

  return {
    tripId,
    balances
  };
}

function hydrateTrip(trip) {
  const participants = trip.participantIds
    .map((participantId) => state.users.find((user) => user.id === participantId))
    .filter(Boolean)
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email
    }));

  return clone({
    ...trip,
    participants
  });
}
