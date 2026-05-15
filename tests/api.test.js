import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { beforeEach, test } from "node:test";
import { createApp } from "../server/app.js";
import { seedStore } from "../server/services/seed.js";
import { resetStore } from "../server/store.js";

let app;

beforeEach(async () => {
  resetStore();
  await seedStore();
  app = createApp();
});

test("private trip APIs require bearer auth", async () => {
  const response = await request("/api/trips");

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    error: "Missing or invalid token"
  });
});

test("login returns JWT and lists trips for the authenticated participant", async () => {
  const { token } = await loginAsDemoUser();

  const response = await request("/api/trips", {
    headers: authHeaders(token)
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.trips.length, 1);
  assert.equal(response.body.trips[0].name, "San Diego Weekend");
  assert.equal(response.body.trips[0].budgetSummary.totalBudget, 900);
});

test("register returns a JWT and starts with no private trips", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Taylor New",
      email: "taylor@example.com",
      password: "demo-password"
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, "taylor@example.com");
  assert.equal(response.body.token.split(".").length, 3);

  const tripsResponse = await request("/api/trips", {
    headers: authHeaders(response.body.token)
  });

  assert.equal(tripsResponse.status, 200);
  assert.deepEqual(tripsResponse.body.trips, []);
});

test("duplicate registration is rejected", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Alex Duplicate",
      email: "alex@example.com",
      password: "demo-password"
    }
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "An account with this email already exists"
  });
});

test("trip creation uses the token user as organizer", async () => {
  const { token, user } = await loginAsDemoUser();

  const response = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Joshua Tree",
      destination: "Joshua Tree",
      organizerId: "user_999"
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.trip.organizerId, user.id);
  assert.deepEqual(response.body.trip.participantIds, [user.id]);
});

test("non-participant cannot view private trip details", async () => {
  const organizer = await loginAsDemoUser();
  const tripId = await createTrip(organizer.token);
  const outsider = await registerUser({
    name: "Outsider",
    email: "outsider@example.com"
  });

  const response = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(outsider.token)
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    error: "You are not an approved participant on this trip"
  });
});

test("organizer can add participants by email", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const response = await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Riley Traveler",
      email: "riley@example.com",
      role: "participant"
    }
  });

  assert.equal(response.status, 200);
  const participant = response.body.trip.participants.find(
    (entry) => entry.email === "riley@example.com"
  );
  assert.equal(participant.role, "participant");
  assert.equal(participant.joinStatus, "approved");
});

test("regular participants cannot add participants or set budgets", async () => {
  const { token } = await loginAsDemoUser({
    email: "sam@example.com",
    password: "demo-password"
  });
  const tripId = "trip_4";

  const addParticipantResponse = await request(
    `/api/trips/${tripId}/participants`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: {
        name: "Blocked Guest",
        email: "blocked@example.com"
      }
    }
  );
  const budgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      totalBudget: 1000
    }
  });

  assert.equal(addParticipantResponse.status, 403);
  assert.equal(budgetResponse.status, 403);
  assert.deepEqual(budgetResponse.body, {
    error: "Only an organizer can perform this action"
  });
});

test("organizer can set total and per-person budgets", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const totalBudgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      totalBudget: 1200
    }
  });
  const perPersonBudgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "per-person",
      perPersonBudget: 400
    }
  });

  assert.equal(totalBudgetResponse.status, 200);
  assert.equal(totalBudgetResponse.body.budgetSummary.totalBudget, 1200);
  assert.equal(totalBudgetResponse.body.budgetSummary.perPersonBudget, null);
  assert.equal(perPersonBudgetResponse.status, 200);
  assert.equal(perPersonBudgetResponse.body.budgetSummary.totalBudget, 400);
  assert.equal(perPersonBudgetResponse.body.budgetSummary.perPersonBudget, 400);
});

test("expense API creates equal shares and recalculates balances", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const response = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Lunch",
      amount: 30,
      category: "food",
      expenseType: "shared",
      payerId: user.id,
      splitRule: "equal",
      includedParticipantIds: [user.id]
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.expense.expenseShares[0].shareAmount, 30);
  assert.equal(response.body.balances[0].actualPaid, 30);
  assert.equal(response.body.balances[0].fairShare, 30);
  assert.equal(response.body.balances[0].netBalance, 0);
});

async function loginAsDemoUser({
  email = "alex@example.com",
  password = "demo-password"
} = {}) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: {
      email,
      password
    }
  });

  assert.equal(response.status, 200);
  return response.body;
}

async function registerUser({
  name,
  email,
  password = "demo-password"
}) {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name,
      email,
      password
    }
  });

  assert.equal(response.status, 201);
  return response.body;
}

async function createTrip(token) {
  const response = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "API Test Trip"
    }
  });

  assert.equal(response.status, 201);
  return response.body.trip.id;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`
  };
}

function request(path, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const rawBody = body === undefined ? null : JSON.stringify(body);
    const req = new Readable({
      read() {
        if (rawBody !== null) {
          this.push(rawBody);
        }
        this.push(null);
      }
    });
    req.method = method;
    req.url = path;
    req.headers = normalizeHeaders({
      ...headers,
      ...(rawBody === null
        ? {}
        : {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(rawBody)
          })
    });

    const chunks = [];
    const responseHeaders = {};
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });

    res.statusCode = 200;
    res.req = req;
    res.setHeader = (name, value) => {
      responseHeaders[name.toLowerCase()] = value;
    };
    res.getHeader = (name) => responseHeaders[name.toLowerCase()];
    res.getHeaders = () => responseHeaders;
    res.removeHeader = (name) => {
      delete responseHeaders[name.toLowerCase()];
    };
    res.writeHead = (statusCode, headersToWrite = {}) => {
      res.statusCode = statusCode;
      for (const [name, value] of Object.entries(headersToWrite)) {
        res.setHeader(name, value);
      }
    };
    res.end = (chunk) => {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }

      const text = Buffer.concat(chunks).toString("utf8");
      resolve({
        status: res.statusCode,
        headers: responseHeaders,
        text,
        body: text ? JSON.parse(text) : null
      });
    };

    app.handle(req, res, reject);
  });
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
  );
}
