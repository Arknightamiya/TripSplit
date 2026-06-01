import {
  addExpense,
  addParticipant,
  createTrip,
  createUser,
  findUserByEmail,
  getTripById,
  setBudget,
  startTrip
} from "../store.js";
import { hashPassword } from "./auth.js";

export async function seedStore() {
  if (process.env.DATABASE_URL) {
    return;
  }

  if (findUserByEmail("alex@example.com")) {
    return;
  }

  const organizer = createUser({
    name: "Alex Organizer",
    email: "alex@example.com",
    passwordHash: hashPassword("Demo-password1!")
  });
  const sam = createUser({
    name: "Sam Traveler",
    email: "sam@example.com",
    passwordHash: hashPassword("Demo-password1!")
  });
  const jordan = createUser({
    name: "Jordan Budgeter",
    email: "jordan@example.com",
    passwordHash: hashPassword("Demo-password1!")
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
  setBudget(trip.id, { mode: "total", totalBudget: 900 });
  startTrip(trip.id);

  addExpense(trip.id, {
    title: "Hotel",
    amount: 450,
    category: "lodging",
    expenseType: "personal_advance",
    payerId: organizer.id,
    splitRule: "equal",
    includedParticipantIds: hydratedTrip.participantIds
  });

  addExpense(trip.id, {
    title: "Dinner",
    amount: 90,
    category: "food",
    expenseType: "personal_advance",
    payerId: sam.id,
    splitRule: "equal",
    includedParticipantIds: hydratedTrip.participantIds
  });
}
