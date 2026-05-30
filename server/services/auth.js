import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByName
} from "../store.js";
import {
  createUserRecord,
  findUserRecordByEmail,
  findUserRecordById,
  findUserRecordByName,
  isUserRepositoryEnabled
} from "../repositories/users.js";
import { badRequest, conflict, unauthorized } from "../utils/errors.js";
import { requireFields } from "../validators/request.js";

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function registerUser(input = {}) {
  requireFields(input, ["name", "email", "password"]);

  if (String(input.password).length < 8) {
    throw badRequest("Password must be at least 8 characters long");
  }

  if (await findAuthUserByEmail(input.email)) {
    throw conflict("An account with this email already exists");
  }

  const assignedUserId = await assignUserId(input.name);

  const userRecord = await createAuthUser({
    name: assignedUserId,
    displayName: input.displayName || assignedUserId,
    email: input.email,
    passwordHash: hashPassword(input.password)
  });

  return {
    user: toSafeUser(userRecord),
    token: signToken({ sub: userRecord.id })
  };
}

export async function loginUser(input = {}) {
  requireFields(input, ["password"]);

  const identifier = input.identifier ?? input.email;
  if (!identifier) {
    throw badRequest("Missing required field: identifier");
  }

  const userRecord = await findAuthUserByIdentifier(identifier);
  if (!userRecord || !verifyPassword(input.password, userRecord.passwordHash)) {
    throw unauthorized("Invalid credentials");
  }

  return {
    user: toSafeUser(userRecord),
    token: signToken({ sub: userRecord.id })
  };
}

export async function getUserFromToken(token) {
  const payload = verifyToken(token);
  const user = await findAuthUserById(payload.sub);

  if (!user) {
    throw unauthorized("Token user no longer exists");
  }

  return toSafeUser(user);
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHash] = String(storedHash || "").split("$");

  if (algorithm !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const actual = Buffer.from(scryptSync(String(password), salt, 32).toString("hex"));
  const expected = Buffer.from(expectedHash);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function signToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const claims = {
    ...payload,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  };
  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
  const signature = sign(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

function verifyToken(token) {
  const [encodedHeader, encodedPayload, signature] = String(token || "").split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw unauthorized();
  }

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(unsignedToken);

  if (!safeCompare(signature, expectedSignature)) {
    throw unauthorized();
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);

  if (!payload.sub) {
    throw badRequest("Token is missing subject");
  }

  if (payload.exp && payload.exp < now) {
    throw unauthorized("Token has expired");
  }

  return payload;
}

function sign(value) {
  return createHmac("sha256", getJwtSecret()).update(value).digest("base64url");
}

function safeCompare(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getJwtSecret() {
  return process.env.JWT_SECRET || "tripsplit-local-development-secret";
}

async function createAuthUser({ name, displayName, email, passwordHash }) {
  if (isUserRepositoryEnabled()) {
    return createUserRecord({ name, displayName, email, passwordHash });
  }

  return createUser({ name, displayName, email, passwordHash });
}

async function findAuthUserByEmail(email) {
  if (isUserRepositoryEnabled()) {
    return findUserRecordByEmail(email);
  }

  return findUserByEmail(email);
}

async function findAuthUserByIdentifier(identifier) {
  const normalizedIdentifier = String(identifier || "").trim();

  if (normalizedIdentifier.includes("@")) {
    return findAuthUserByEmail(normalizedIdentifier);
  }

  return (
    await findAuthUserById(normalizedIdentifier) ||
    await findAuthUserByName(normalizedIdentifier)
  );
}

async function findAuthUserById(userId) {
  if (isUserRepositoryEnabled()) {
    return findUserRecordById(userId);
  }

  return findUserById(userId);
}

async function findAuthUserByName(name) {
  if (isUserRepositoryEnabled()) {
    return findUserRecordByName(name);
  }

  return findUserByName(name);
}

async function assignUserId(requestedUserId) {
  const baseUserId = normalizeUserIdBase(requestedUserId);
  if (!baseUserId) {
    throw badRequest("User ID is required");
  }

  let discriminator = (await findAuthUserByName(baseUserId)) ? 2 : 1;
  let candidate = `${baseUserId}#${discriminator}`;

  while (await findAuthUserByName(candidate)) {
    discriminator += 1;
    candidate = `${baseUserId}#${discriminator}`;
  }

  return candidate;
}

function normalizeUserIdBase(userId) {
  return String(userId || "")
    .trim()
    .replace(/#\d+$/, "")
    .trim();
}

function toSafeUser(user) {
  return {
    id: user.id,
    userId: user.userId || user.name,
    name: user.name,
    displayName: user.displayName || user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || ""
  };
}
