import {
  API_ROUTES,
  AUTH_HEADER,
  AUTH_TOKEN_STORAGE_KEY
} from "/shared/contracts.js";

export const SESSION_EXPIRED_ERROR_MESSAGE = "Your session expired. Please log in again.";

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const body = prepareBody(options.body, headers);
  const token = getStoredAuthToken();

  if (token && !headers.has(AUTH_HEADER)) {
    headers.set(AUTH_HEADER, `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    const shouldHandleUnauthorized = response.status === 401 && !options.skipUnauthorizedHandler;
    const error = new ApiError(
      shouldHandleUnauthorized
        ? SESSION_EXPIRED_ERROR_MESSAGE
        : payload?.error || `Request failed with status ${response.status}`,
      response.status,
      payload
    );

    if (shouldHandleUnauthorized) {
      unauthorizedHandler?.(error);
    }

    throw error;
  }

  return payload;
}

const CURRENT_USER_STORAGE_KEY = "tripsplit.currentUser";
let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
}

export function getStoredCurrentUser() {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeCurrentUser(user) {
  window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
}

export function storeAuthSession({ token, user }) {
  storeAuthToken(token);
  storeCurrentUser(user);
}

export function clearAuthSession() {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}

export async function login({ identifier, email, password }) {
  return apiRequest(API_ROUTES.authLogin, {
    method: "POST",
    skipUnauthorizedHandler: true,
    body: {
      identifier: identifier ?? email,
      password
    }
  });
}

export async function register({ name, email, password }) {
  return apiRequest(API_ROUTES.authRegister, {
    method: "POST",
    body: { name, email, password }
  });
}

export async function fetchCurrentUserProfile(options = {}) {
  return apiRequest(API_ROUTES.me, options);
}

export async function updateCurrentUserProfile({ displayName, avatarUrl }) {
  return apiRequest(API_ROUTES.me, {
    method: "PATCH",
    body: { displayName, avatarUrl }
  });
}

export async function fetchHealth(){
      return apiRequest(API_ROUTES.health);
}

export async function fetchCurrencies() {
  return apiRequest(API_ROUTES.currencies);
}

export async function fetchTrips(){
    return apiRequest(API_ROUTES.trips);
}

export async function fetchFriends() {
  return apiRequest(API_ROUTES.friends);
}

export async function fetchFriendPublicTrips() {
  return apiRequest(API_ROUTES.friendPublicTrips);
}

export async function searchUsersForFriend(query) {
  const params = new URLSearchParams({ query });
  return apiRequest(`${API_ROUTES.friendSearch}?${params.toString()}`);
}

export async function sendFriendRequest(identifier) {
  return apiRequest(API_ROUTES.friendRequests, {
    method: "POST",
    body: { identifier }
  });
}

export async function respondToFriendRequest(requestId, action) {
  return apiRequest(API_ROUTES.friendRequestAction(requestId, action), {
    method: "POST"
  });
}

export async function removeFriend(friendId) {
  return apiRequest(API_ROUTES.friend(friendId), {
    method: "DELETE"
  });
}

export async function fetchFriendProfile(friendId) {
  return apiRequest(API_ROUTES.friend(friendId));
}

export async function requestTripJoin(tripId) {
  return apiRequest(API_ROUTES.tripJoinRequests(tripId), {
    method: "POST"
  });
}

export async function respondToTripJoinRequest(requestId, action) {
  return apiRequest(API_ROUTES.tripJoinRequestAction(requestId, action), {
    method: "POST"
  });
}

export async function respondToTripInvitation(tripId, action) {
  return apiRequest(API_ROUTES.tripInvitationAction(tripId, action), {
    method: "POST"
  });
}

export async function postTrip({
    name,
    visibility = "public",
    startDate = "",
    endDate = "",
    inviteeUserIds = []
}){
    return apiRequest(API_ROUTES.trips, {
        method: "POST",
        body: {
            name,
            destination: name,
            visibility,
            startDate: startDate || null,
            endDate: endDate || null,
            inviteeUserIds
        }
    });
}

export async function fetchTrip(tripId) {
  return apiRequest(API_ROUTES.trip(tripId));
}

export async function updateTrip(tripId, payload) {
  return apiRequest(API_ROUTES.trip(tripId), {
    method: "PATCH",
    body: payload
  });
}

export async function deleteTrip(tripId) {
  const normalizedTripId = String(tripId || "").trim();
  if (!normalizedTripId) {
    throw new Error("No trip selected to delete.");
  }

  return apiRequest(API_ROUTES.trip(normalizedTripId), {
    method: "DELETE"
  });
}

export async function inviteParticipant(tripId, userId) {
  return apiRequest(API_ROUTES.tripInvitations(tripId), {
    method: "POST",
    body: {
      userId,
      role: "participant"
    }
  });
}

export async function removeTripParticipant(tripId, participantId) {
  return apiRequest(API_ROUTES.tripParticipant(tripId, participantId), {
    method: "DELETE"
  });
}

export async function postBudget(tripId, payload) {
  return apiRequest(API_ROUTES.budget(tripId), {
    method: "POST",
    body: payload
  });
}

export async function postExpense(tripId, payload) {
  return apiRequest(API_ROUTES.expenses(tripId), {
    method: "POST",
    body: payload
  });
}

export async function deleteExpense(tripId, expenseId) {
  return apiRequest(API_ROUTES.expense(tripId, expenseId), {
    method: "DELETE"
  });
}

export async function fetchBalances(tripId) {
  return apiRequest(API_ROUTES.balances(tripId));
}

export function getStoredAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeAuthToken(token) {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

function prepareBody(body, headers) {
  if (body === undefined || body === null) {
    return body;
  }

  if (body instanceof FormData || typeof body === "string") {
    return body;
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return JSON.stringify(body);
}

async function parseJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
