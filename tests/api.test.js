import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { beforeEach, test } from "node:test";
import { createApp } from "../server/app.js";
import { seedStore } from "../server/services/seed.js";
import { resetStore } from "../server/store.js";

let app;

beforeEach(() => {
  resetStore();
  seedStore();
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

async function loginAsDemoUser() {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: {
      email: "alex@example.com",
      password: "demo-password"
    }
  });

  assert.equal(response.status, 200);
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
