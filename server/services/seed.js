import {
  addExpense,
  addParticipant,
  createFriendRequest,
  createTrip,
  createUser,
  findUserByEmail,
  getTripById,
  respondToFriendRequest,
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
  createUser({
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

  const friendRequest = createFriendRequest({
    requesterId: organizer.id,
    recipientId: sam.id
  });
  respondToFriendRequest(friendRequest.id, sam.id, "accepted");

  createTrip({
    name: "Yosemite Weekend",
    destination: "Yosemite",
    startDate: "2026-06-20",
    endDate: "2026-06-22",
    visibility: "public",
    organizerId: sam.id
  });
}
