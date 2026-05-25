import {
  API_ROUTES,
  AUTH_HEADER,
  AUTH_TOKEN_STORAGE_KEY
} from "/shared/contracts.js";

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
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

const CURRENT_USER_STORAGE_KEY = "tripsplit.currentUser";

export async function ensureDemoAuth() {
  const credentials = {
    email: "alex@example.com",
    password: "demo-password"
  };
  let authResult;

  try {
    authResult = await login(credentials);
  } catch (error) {
    authResult = await register({
      name: "Alex Organizer",
      ...credentials
    });
  }

  const { token, user } = authResult;
  storeAuthToken(token);
  storeCurrentUser(user);
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

export async function login({ email, password }) {
  return apiRequest(API_ROUTES.authLogin, {
    method: "POST",
    body: { email, password }
  });
}

export async function register({ name, email, password }) {
  return apiRequest(API_ROUTES.authRegister, {
    method: "POST",
    body: { name, email, password }
  });
}

export async function fetchHealth(){
      return apiRequest(API_ROUTES.health);
}

export async function fetchTrips(){
    return apiRequest(API_ROUTES.trips);
}

export async function postTrip(name){
    return apiRequest(API_ROUTES.trips, {
        method: "POST",
        body: { name }
    });
}

export async function fetchTrip(tripId) {
  return apiRequest(API_ROUTES.trip(tripId));
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
