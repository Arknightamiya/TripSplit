import {
  addExpense,
  addParticipant,
  authenticateUser,
  createTrip,
  createUser,
  deleteExpense,
  getBalances,
  getTripById,
  listTrips,
  setBudget
} from "./store.js";

export async function handleApiRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments[0] !== "api") {
    return false;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "TripSplit API" });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await parseBody(req);
    const user = createUser(body);
    return sendJson(res, 201, {
      user: omitPassword(user),
      token: `demo-token-${user.id}`
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await parseBody(req);
    const user = authenticateUser(body);

    if (!user) {
      return sendJson(res, 401, { error: "Invalid credentials" });
    }

    return sendJson(res, 200, {
      user: omitPassword(user),
      token: `demo-token-${user.id}`
    });
  }

  if (req.method === "GET" && url.pathname === "/api/trips") {
    return sendJson(res, 200, { trips: listTrips() });
  }

  if (req.method === "POST" && url.pathname === "/api/trips") {
    const body = await parseBody(req);
    const trip = createTrip(body);
    return sendJson(res, 201, { trip });
  }

  if (segments[1] === "trips" && segments[2]) {
    const tripId = segments[2];

    if (req.method === "GET" && segments.length === 3) {
      const trip = getTripById(tripId);
      return trip
        ? sendJson(res, 200, { trip })
        : sendJson(res, 404, { error: "Trip not found" });
    }

    if (req.method === "POST" && segments[3] === "participants") {
      const body = await parseBody(req);
      const trip = addParticipant(tripId, body);
      return trip
        ? sendJson(res, 200, { trip })
        : sendJson(res, 404, { error: "Trip not found" });
    }

    if (req.method === "POST" && segments[3] === "budget") {
      const body = await parseBody(req);
      const trip = setBudget(tripId, body);
      return trip
        ? sendJson(res, 200, { trip })
        : sendJson(res, 404, { error: "Trip not found" });
    }

    if (req.method === "POST" && segments[3] === "expenses") {
      const body = await parseBody(req);
      const trip = addExpense(tripId, body);
      return trip
        ? sendJson(res, 201, { trip })
        : sendJson(res, 404, { error: "Trip not found" });
    }

    if (req.method === "GET" && segments[3] === "balances") {
      const balances = getBalances(tripId);
      return balances
        ? sendJson(res, 200, balances)
        : sendJson(res, 404, { error: "Trip not found" });
    }

    if (
      req.method === "DELETE" &&
      segments[3] === "expenses" &&
      segments[4]
    ) {
      const result = deleteExpense(tripId, segments[4]);

      if (result === false) {
        return sendJson(res, 404, { error: "Expense not found" });
      }

      return result
        ? sendJson(res, 200, { trip: result })
        : sendJson(res, 404, { error: "Trip not found" });
    }
  }

  return sendJson(res, 404, { error: "Route not found" });
}

export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
  return true;
}

async function parseBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function omitPassword(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}
