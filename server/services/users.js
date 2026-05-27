import {
  findUserById,
  updateUserProfile
} from "../store.js";
import {
  findUserRecordById,
  isUserRepositoryEnabled,
  updateUserProfileRecord
} from "../repositories/users.js";
import { badRequest, notFound } from "../utils/errors.js";

const MAX_AVATAR_DATA_URL_LENGTH = 1_200_000;

export async function getCurrentUserProfile(userId) {
  const user = isUserRepositoryEnabled()
    ? await findUserRecordById(userId)
    : findUserById(userId);

  if (!user) {
    throw notFound("User not found");
  }

  return {
    user: toProfileUser(user)
  };
}

export async function updateCurrentUserProfile(userId, input = {}) {
  const displayName = normalizeDisplayName(input.displayName);
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl);

  if (!displayName) {
    throw badRequest("Display name is required");
  }

  validateAvatarUrl(avatarUrl);

  const user = isUserRepositoryEnabled()
    ? await updateUserProfileRecord(userId, { displayName, avatarUrl })
    : updateUserProfile(userId, { displayName, avatarUrl });

  if (!user) {
    throw notFound("User not found");
  }

  return {
    user: toProfileUser(user)
  };
}

function toProfileUser(user) {
  return {
    id: user.id,
    userId: user.userId || user.name,
    name: user.name,
    displayName: user.displayName || user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || ""
  };
}

function normalizeDisplayName(displayName) {
  return String(displayName || "").trim();
}

function normalizeAvatarUrl(avatarUrl) {
  return String(avatarUrl || "").trim();
}

function validateAvatarUrl(avatarUrl) {
  if (!avatarUrl) {
    return;
  }

  if (avatarUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
    throw badRequest("Avatar image is too large");
  }

  if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(avatarUrl)) {
    throw badRequest("Avatar must be an uploaded image");
  }
}
