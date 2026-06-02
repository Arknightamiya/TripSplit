import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createUser,
  deletePendingRegistration,
  findUserByEmail,
  findUserById,
  findUserByName,
  findPendingRegistrationByEmail,
  updatePendingRegistration,
  upsertPendingRegistration
} from "../store.js";
import {
  deletePendingRegistrationRecord,
  findPendingRegistrationRecordByEmail,
  updatePendingRegistrationRecord,
  upsertPendingRegistrationRecord
} from "../repositories/pendingRegistrations.js";
import {
  createUserRecord,
  findUserRecordByEmail,
  findUserRecordById,
  findUserRecordByName,
  isUserRepositoryEnabled
} from "../repositories/users.js";
import { sendRegistrationVerificationEmail } from "./email.js";
import { badRequest, conflict, unauthorized } from "../utils/errors.js";
import { requireFields } from "../validators/request.js";

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const VERIFICATION_CODE_TTL_MINUTES = 5;
const VERIFICATION_CODE_TTL_MS = VERIFICATION_CODE_TTL_MINUTES * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;
const RESEND_CLOCK_DRIFT_TOLERANCE_MS = 5 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const PASSWORD_POLICY_ERROR =
  "Password must be at least 8 characters long and include uppercase, lowercase, number, and symbol.";
const resendCooldowns = new Map();

export async function registerUser(input = {}) {
  requireFields(input, ["name", "email", "password"]);
  const email = normalizeEmail(input.email);
  const name = String(input.name || "").trim();

  if (!isStrongPassword(input.password)) {
    throw badRequest(PASSWORD_POLICY_ERROR);
  }

  if (await findAuthUserByEmail(email)) {
    throw conflict("An account with this email already exists");
  }

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS).toISOString();
  const resendAvailableAt = new Date(Date.now() + RESEND_INTERVAL_MS).toISOString();
  rememberResendCooldown(email, resendAvailableAt);

  const pendingRegistration = await upsertAuthPendingRegistration({
    email,
    name,
    passwordHash: hashPassword(input.password),
    verificationCodeHash: hashVerificationCode(email, code),
    expiresAt,
    resendAvailableAt
  });

  await sendRegistrationVerificationEmail({
    email,
    code,
    expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES
  });

  return {
    email: pendingRegistration.email,
    expiresAt: pendingRegistration.expiresAt,
    resendAvailableAt: pendingRegistration.resendAvailableAt,
    message: "Verification code sent"
  };
}

export async function verifyRegistration(input = {}) {
  requireFields(input, ["email", "code"]);
  const email = normalizeEmail(input.email);
  const code = normalizeVerificationCode(input.code);

  if (!/^\d{6}$/.test(code)) {
    throw badRequest("Verification code must be 6 digits");
  }

  const pendingRegistration = await findAuthPendingRegistrationByEmail(email);

  if (!pendingRegistration) {
    throw badRequest("No pending registration found for this email");
  }

  if (await findAuthUserByEmail(email)) {
    await deleteAuthPendingRegistration(email);
    throw conflict("An account with this email already exists");
  }

  if (pendingRegistration.attemptCount >= MAX_VERIFICATION_ATTEMPTS) {
    throw badRequest("Too many incorrect attempts. Please resend a new code.");
  }

  if (Date.parse(pendingRegistration.expiresAt) < Date.now()) {
    throw badRequest("Verification code has expired. Please resend a new code.");
  }

  if (!safeCompare(hashVerificationCode(email, code), pendingRegistration.verificationCodeHash)) {
    await updateAuthPendingRegistration(email, {
      attemptCount: pendingRegistration.attemptCount + 1
    });
    throw badRequest("Invalid verification code");
  }

  const assignedUserId = await assignUserId(pendingRegistration.name);
  const userRecord = await createAuthUser({
    name: assignedUserId,
    displayName: assignedUserId,
    email,
    passwordHash: pendingRegistration.passwordHash
  });

  await deleteAuthPendingRegistration(email);

  return {
    user: toSafeUser(userRecord),
    token: signToken({ sub: userRecord.id })
  };
}

export async function resendRegistrationCode(input = {}) {
  requireFields(input, ["email"]);
  const email = normalizeEmail(input.email);
  const pendingRegistration = await findAuthPendingRegistrationByEmail(email);

  if (!pendingRegistration) {
    throw badRequest("No pending registration found for this email");
  }

  if (await findAuthUserByEmail(email)) {
    await deleteAuthPendingRegistration(email);
    throw conflict("An account with this email already exists");
  }

  const cooldownRemainingMs = getResendCooldownRemainingMs(email, pendingRegistration);

  if (cooldownRemainingMs > 0) {
    throw badRequest("Please wait before requesting another verification code", {
      retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000)
    });
  }

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS).toISOString();
  const resendAvailableAt = new Date(Date.now() + RESEND_INTERVAL_MS).toISOString();
  rememberResendCooldown(email, resendAvailableAt);

  const updatedRegistration = await updateAuthPendingRegistration(email, {
    verificationCodeHash: hashVerificationCode(email, code),
    expiresAt,
    resendAvailableAt,
    attemptCount: 0
  });

  await sendRegistrationVerificationEmail({
    email,
    code,
    expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES
  });

  return {
    email: updatedRegistration.email,
    expiresAt: updatedRegistration.expiresAt,
    resendAvailableAt: updatedRegistration.resendAvailableAt,
    retryAfterSeconds: Math.ceil(RESEND_INTERVAL_MS / 1000),
    message: "Verification code sent"
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

export function isStrongPassword(password) {
  const value = String(password || "");
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function generateVerificationCode() {
  return String(randomBytes(4).readUInt32BE() % 1000000).padStart(6, "0");
}

function rememberResendCooldown(email, resendAvailableAt) {
  resendCooldowns.set(normalizeEmail(email), Date.parse(resendAvailableAt));
}

function getResendCooldownRemainingMs(email, pendingRegistration) {
  const now = Date.now();
  const storedAvailableAt = Date.parse(pendingRegistration.resendAvailableAt);
  const storedRemainingMs = Number.isFinite(storedAvailableAt) ? storedAvailableAt - now : 0;

  if (storedRemainingMs <= 0) {
    resendCooldowns.delete(normalizeEmail(email));
    return 0;
  }

  const rememberedAvailableAt = resendCooldowns.get(normalizeEmail(email));
  const rememberedRemainingMs = Number.isFinite(rememberedAvailableAt)
    ? rememberedAvailableAt - now
    : 0;

  if (rememberedRemainingMs > 0) {
    return Math.min(rememberedRemainingMs, RESEND_INTERVAL_MS);
  }

  if (storedRemainingMs > RESEND_INTERVAL_MS + RESEND_CLOCK_DRIFT_TOLERANCE_MS) {
    return 0;
  }

  return Math.min(storedRemainingMs, RESEND_INTERVAL_MS);
}

function hashVerificationCode(email, code) {
  return createHmac("sha256", getJwtSecret())
    .update(`${normalizeEmail(email)}:${normalizeVerificationCode(code)}`)
    .digest("hex");
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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeVerificationCode(code) {
  return String(code || "").replace(/\s/g, "");
}

async function upsertAuthPendingRegistration(payload) {
  if (isUserRepositoryEnabled()) {
    return upsertPendingRegistrationRecord(payload);
  }

  return upsertPendingRegistration(payload);
}

async function findAuthPendingRegistrationByEmail(email) {
  if (isUserRepositoryEnabled()) {
    return findPendingRegistrationRecordByEmail(email);
  }

  return findPendingRegistrationByEmail(email);
}

async function updateAuthPendingRegistration(email, updates) {
  if (isUserRepositoryEnabled()) {
    return updatePendingRegistrationRecord(email, updates);
  }

  return updatePendingRegistration(email, updates);
}

async function deleteAuthPendingRegistration(email) {
  if (isUserRepositoryEnabled()) {
    return deletePendingRegistrationRecord(email);
  }

  return deletePendingRegistration(email);
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
