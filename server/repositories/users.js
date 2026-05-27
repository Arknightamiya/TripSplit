import { getDatabase } from "../db/pool.js";

export function isUserRepositoryEnabled() {
  return getDatabase().enabled;
}

export async function createUserRecord({ name, email, passwordHash, displayName, avatarUrl }) {
  const normalizedName = normalizeName(name);
  const result = await getDatabase().query(
    `
      INSERT INTO users (name, display_name, email, password_hash, avatar_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, display_name, email, password_hash, avatar_url
    `,
    [
      normalizedName,
      normalizeName(displayName) || normalizedName,
      normalizeEmail(email),
      passwordHash,
      normalizeAvatarUrl(avatarUrl)
    ]
  );

  return mapUserRow(result.rows[0]);
}

export async function findUserRecordByEmail(email) {
  const result = await getDatabase().query(
    `
      SELECT id, name, email, password_hash
        , display_name, avatar_url
      FROM users
      WHERE email = $1
    `,
    [normalizeEmail(email)]
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function findUserRecordByName(name) {
  const result = await getDatabase().query(
    `
      SELECT id, name, email, password_hash
        , display_name, avatar_url
      FROM users
      WHERE LOWER(name) = LOWER($1)
      ORDER BY id ASC
      LIMIT 1
    `,
    [normalizeName(name)]
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
        , display_name, avatar_url
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function updateUserProfileRecord(userId, { displayName, avatarUrl }) {
  if (!isNumericId(userId)) {
    return null;
  }

  const result = await getDatabase().query(
    `
      UPDATE users
      SET
        display_name = $2,
        avatar_url = $3
      WHERE id = $1
      RETURNING id, name, display_name, email, password_hash, avatar_url
    `,
    [userId, normalizeName(displayName), normalizeAvatarUrl(avatarUrl)]
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

function mapUserRow(row) {
  return {
    id: String(row.id),
    name: row.name,
    userId: row.name,
    displayName: row.display_name || row.name,
    email: row.email,
    passwordHash: row.password_hash,
    avatarUrl: row.avatar_url || ""
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(name) {
  return String(name || "").trim();
}

function normalizeAvatarUrl(avatarUrl) {
  return String(avatarUrl || "").trim();
}

function isNumericId(value) {
  return /^\d+$/.test(String(value || ""));
}
