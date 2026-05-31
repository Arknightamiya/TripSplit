export const API_BASE = "/api";

export const API_ROUTES = {
  health: `${API_BASE}/health`,
  authRegister: `${API_BASE}/auth/register`,
  authLogin: `${API_BASE}/auth/login`,
  me: `${API_BASE}/me`,
  currencies: `${API_BASE}/currencies`,
  friends: `${API_BASE}/friends`,
  friendSearch: `${API_BASE}/friends/search`,
  friendPublicTrips: `${API_BASE}/friends/public-trips`,
  friendRequests: `${API_BASE}/friends/requests`,
  friendRequestAction: (requestId, action) => `${API_BASE}/friends/requests/${requestId}/${action}`,
  friend: (friendId) => `${API_BASE}/friends/${friendId}`,
  tripJoinRequests: (tripId) => `${API_BASE}/friends/trips/${tripId}/join-requests`,
  tripJoinRequestAction: (requestId, action) => `${API_BASE}/friends/trip-join-requests/${requestId}/${action}`,
  tripInvitationAction: (tripId, action) => `${API_BASE}/friends/trip-invitations/${tripId}/${action}`,
  trips: `${API_BASE}/trips`,
  trip: (tripId) => `${API_BASE}/trips/${tripId}`,
  tripInvitations: (tripId) => `${API_BASE}/trips/${tripId}/invitations`,
  tripParticipants: (tripId) => `${API_BASE}/trips/${tripId}/participants`,
  tripParticipant: (tripId, participantId) => `${API_BASE}/trips/${tripId}/participants/${participantId}`,
  participants: (tripId) => `${API_BASE}/trips/${tripId}/participants`,
  budget: (tripId) => `${API_BASE}/trips/${tripId}/budget`,
  expenses: (tripId) => `${API_BASE}/trips/${tripId}/expenses`,
  expense: (tripId, expenseId) => `${API_BASE}/trips/${tripId}/expenses/${expenseId}`,
  balances: (tripId) => `${API_BASE}/trips/${tripId}/balances`
};

export const EXPENSE_CATEGORIES = [
  "lodging",
  "food",
  "transportation",
  "tickets",
  "drinks",
  "emergency",
  "other"
];

export const BUDGET_MODES = ["total", "per-person"];

export const EXPENSE_TYPES = ["shared", "personal_advance"];

export const SPLIT_RULES = ["equal"];

export const AUTH_HEADER = "Authorization";

export const AUTH_TOKEN_STORAGE_KEY = "tripsplit.authToken";
