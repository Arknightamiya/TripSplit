import { getDatabase } from "../db/pool.js";

export function isUserRepositoryEnabled() {
  return getDatabase().enabled;
}

export async function createUserRecord({ name, email, passwordHash }) {
  const result = await getDatabase().query(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, password_hash
    `,
    [name, normalizeEmail(email), passwordHash]
  );

  return mapUserRow(result.rows[0]);
}

export async function findUserRecordByEmail(email) {
  const result = await getDatabase().query(
    `
      SELECT id, name, email, password_hash
      FROM users
      WHERE email = $1
    `,
    [normalizeEmail(email)]
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function findUserRecordById(userId) {
  if (!isNumericId(userId)) {
    return null;
  }

  const result = await getDatabase().query(
    `
      SELECT id, name, email, password_hash
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

function mapUserRow(row) {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isNumericId(value) {
  return /^\d+$/.test(String(value || ""));
}
