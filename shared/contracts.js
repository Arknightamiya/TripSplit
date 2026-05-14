export const API_BASE = "/api";

export const API_ROUTES = {
  health: `${API_BASE}/health`,
  authRegister: `${API_BASE}/auth/register`,
  authLogin: `${API_BASE}/auth/login`,
  trips: `${API_BASE}/trips`,
  trip: (tripId) => `${API_BASE}/trips/${tripId}`,
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
