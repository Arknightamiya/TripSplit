import { getDatabase } from "../db/pool.js";

export async function upsertPendingRegistrationRecord({
  email,
  name,
  passwordHash,
  verificationCodeHash,
  expiresAt,
  resendAvailableAt
}) {
  const result = await getDatabase().query(
    `
      INSERT INTO pending_registrations (
        email,
        name,
        password_hash,
        verification_code_hash,
        expires_at,
        resend_available_at,
        attempt_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, 0)
      ON CONFLICT (email) DO UPDATE
      SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        verification_code_hash = EXCLUDED.verification_code_hash,
        expires_at = EXCLUDED.expires_at,
        resend_available_at = EXCLUDED.resend_available_at,
        attempt_count = 0,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [
      normalizeEmail(email),
      normalizeName(name),
      passwordHash,
      verificationCodeHash,
      expiresAt,
      resendAvailableAt
    ]
  );

  return mapPendingRegistrationRow(result.rows[0]);
}

export async function findPendingRegistrationRecordByEmail(email) {
  const result = await getDatabase().query(
    `
      SELECT *
      FROM pending_registrations
      WHERE email = $1
    `,
    [normalizeEmail(email)]
  );

  return result.rows[0] ? mapPendingRegistrationRow(result.rows[0]) : null;
}

export async function updatePendingRegistrationRecord(email, updates = {}) {
  const current = await findPendingRegistrationRecordByEmail(email);

  if (!current) {
    return null;
  }

  const next = {
    verificationCodeHash: updates.verificationCodeHash ?? current.verificationCodeHash,
    expiresAt: updates.expiresAt ?? current.expiresAt,
    resendAvailableAt: updates.resendAvailableAt ?? current.resendAvailableAt,
    attemptCount: updates.attemptCount ?? current.attemptCount
  };

  const result = await getDatabase().query(
    `
      UPDATE pending_registrations
      SET
        verification_code_hash = $2,
        expires_at = $3,
        resend_available_at = $4,
        attempt_count = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = $1
      RETURNING *
    `,
    [
      normalizeEmail(email),
      next.verificationCodeHash,
      next.expiresAt,
      next.resendAvailableAt,
      next.attemptCount
    ]
  );

  return result.rows[0] ? mapPendingRegistrationRow(result.rows[0]) : null;
}

export async function deletePendingRegistrationRecord(email) {
  const result = await getDatabase().query(
    `
      DELETE FROM pending_registrations
      WHERE email = $1
    `,
    [normalizeEmail(email)]
  );

  return result.rowCount > 0;
}

function mapPendingRegistrationRow(row) {
  return {
    id: String(row.id),
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    verificationCodeHash: row.verification_code_hash,
    expiresAt: toIsoString(row.expires_at),
    resendAvailableAt: toIsoString(row.resend_available_at),
    attemptCount: Number(row.attempt_count || 0),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(name) {
  return String(name || "").trim();
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
