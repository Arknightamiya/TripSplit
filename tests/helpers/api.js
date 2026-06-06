import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { getLastRegistrationVerificationCode } from "../../server/services/email.js";

export function createRequest(appProvider) {
  return function request(path, { method = "GET", headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
      const app = typeof appProvider === "function" && !appProvider.handle
        ? appProvider()
        : appProvider;
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
  };
}

export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function startRegistration(request, {
  name,
  email,
  password = "Demo-password1!"
}) {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name,
      email,
      password
    }
  });

  assert.equal(response.status, 202);
  return response.body;
}

export async function registerUser(request, {
  name,
  email,
  password = "Demo-password1!"
}) {
  await startRegistration(request, { name, email, password });

  const response = await request("/api/auth/register/verify", {
    method: "POST",
    body: {
      email,
      code: getLastRegistrationVerificationCode(email)
    }
  });

  assert.equal(response.status, 201);
  return response.body;
}

export async function loginOrRegisterUser(request, { identifier, name, email, password }) {
  const loginResponse = await request("/api/auth/login", {
    method: "POST",
    body: {
      identifier,
      password
    }
  });

  if (loginResponse.status === 200) {
    return loginResponse.body;
  }

  return registerUser(request, { name, email, password });
}

export async function sendAndAcceptFriendRequest(request, { requester, recipient }) {
  const requestResponse = await request("/api/friends/requests", {
    method: "POST",
    headers: authHeaders(requester.token),
    body: {
      identifier: recipient.user.userId
    }
  });
  const recipientOverview = await request("/api/friends", {
    headers: authHeaders(recipient.token)
  });
  const acceptResponse = await request(
    `/api/friends/requests/${recipientOverview.body.incomingRequests[0].id}/accept`,
    {
      method: "POST",
      headers: authHeaders(recipient.token)
    }
  );

  assert.equal(requestResponse.status, 201);
  assert.equal(acceptResponse.status, 200);
  assert.equal(acceptResponse.body.request.status, "accepted");
}

export function assertBudget(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `Expected budget ${key} to equal ${value}`);
  }
}

export function assertBalances(actualBalances, expectedBalances) {
  assert.deepEqual(
    normalizeBalances(actualBalances),
    expectedBalances.map((balance) => ({
      participantId: balance.participantId,
      actualPaid: balance.actualPaid,
      fairShare: balance.fairShare,
      netBalance: balance.netBalance
    }))
  );
}

export function assertNetBalancesConserved(balances) {
  assert.equal(
    roundCurrency(balances.reduce((sum, balance) => sum + balance.netBalance, 0)),
    0
  );
}

function normalizeBalances(balances) {
  return balances.map(({ participantId, actualPaid, fairShare, netBalance }) => ({
    participantId,
    actualPaid,
    fairShare,
    netBalance
  }));
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
  );
}
