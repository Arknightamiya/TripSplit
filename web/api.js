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

function getStoredAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
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
