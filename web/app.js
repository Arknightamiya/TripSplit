import {
  clearAuthSession,
  deleteTrip,
  fetchBalances,
  fetchCurrentUserProfile,
  fetchHealth,
  fetchTrip,
  fetchTrips,
  getStoredCurrentUser,
  login,
  register,
  storeAuthSession,
  storeCurrentUser,
  updateCurrentUserProfile
} from "./api.js";
import { setupTripForm } from "./forms.js";
import { renderBalances } from "./renderBalances.js";
import { renderBudget } from "./renderBudget.js";
import { renderExpenses } from "./renderExpenses.js";
import { escapeHtml, pluralize, renderTrips } from "./renderTrips.js";

const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const authTabs = document.querySelectorAll("[data-auth-mode]");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const loginError = document.querySelector("#login-error");
const registerError = document.querySelector("#register-error");
const differentAccountButton = document.querySelector("#different-account-button");
const currentUserName = document.querySelector("#current-user-name");
const currentUserId = document.querySelector("#current-user-id");
const currentUserAvatar = document.querySelector("#current-user-avatar");
const currentUserAvatarFallback = document.querySelector("#current-user-avatar-fallback");
const profileButton = document.querySelector("#profile-button");
const logoutButton = document.querySelector("#logout-button");
const statusText = document.querySelector("#status-text");
const tripList = document.querySelector("#trip-list");
const tripForm = document.querySelector("#trip-form");
const detailSection = document.querySelector("#trip-detail");
const detailTitle = document.querySelector("#detail-title");
const detailEyebrow = document.querySelector("#detail-eyebrow");
const detailMeta = document.querySelector("#detail-meta");
const detailParticipants = document.querySelector("#detail-participants");
const detailClose = document.querySelector("#detail-close");
const detailDelete = document.querySelector("#detail-delete");
const deleteTripDialog = document.querySelector("#delete-trip-dialog");
const deleteTripYes = document.querySelector("#delete-trip-yes");
const deleteTripNo = document.querySelector("#delete-trip-no");
const deleteTripError = document.querySelector("#delete-trip-error");
const profileDialog = document.querySelector("#profile-dialog");
const profileForm = document.querySelector("#profile-form");
const profileClose = document.querySelector("#profile-close");
const profileError = document.querySelector("#profile-error");
const profileAvatarPreview = document.querySelector("#profile-avatar-preview");
const profileAvatarFallback = document.querySelector("#profile-avatar-fallback");
const profileAvatarTrigger = document.querySelector("#profile-avatar-trigger");
const profilePreviewName = document.querySelector("#profile-preview-name");
const profilePreviewId = document.querySelector("#profile-preview-id");
const profileRemoveAvatar = document.querySelector("#profile-remove-avatar");
const avatarViewDialog = document.querySelector("#avatar-view-dialog");
const avatarViewClose = document.querySelector("#avatar-view-close");
const avatarViewImage = document.querySelector("#avatar-view-image");
const avatarViewFallback = document.querySelector("#avatar-view-fallback");
const budgetPanel = document.querySelector("#budget-panel");
const expensesPanel = document.querySelector("#expenses-panel");
const balancesPanel = document.querySelector("#balances-panel");

let activeTripId = null;
let profileAvatarDataUrl = "";
const SAVED_LOGIN_STORAGE_KEY = "tripsplit.savedLogin";
const MAX_AVATAR_FILE_SIZE = 8_000_000;
const AVATAR_IMAGE_SIZE = 256;
const AVATAR_IMAGE_QUALITY = 0.86;

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => showAuthMode(tab.dataset.authMode));
});
loginForm.addEventListener("submit", handleLogin);
registerForm.addEventListener("submit", handleRegister);
differentAccountButton.addEventListener("click", clearSavedLogin);
profileButton.addEventListener("click", openProfileDialog);
logoutButton.addEventListener("click", handleLogout);
profileForm.addEventListener("submit", handleProfileSubmit);
profileClose.addEventListener("click", closeProfileDialog);
profileRemoveAvatar.addEventListener("click", removeProfileAvatar);
profileAvatarTrigger.addEventListener("click", openAvatarViewDialog);
profileForm.elements.avatarFile.addEventListener("change", handleAvatarFileChange);
profileDialog.addEventListener("click", (event) => {
  if (event.target === profileDialog) {
    closeProfileDialog();
  }
});
avatarViewClose.addEventListener("click", closeAvatarViewDialog);
avatarViewDialog.addEventListener("click", (event) => {
  if (event.target === avatarViewDialog) {
    closeAvatarViewDialog();
  }
});
setupTripForm(tripForm, loadTrips);
detailClose.addEventListener("click", closeDetail);
detailDelete.addEventListener("click", openDeleteTripDialog);
deleteTripNo.addEventListener("click", closeDeleteTripDialog);
deleteTripDialog.addEventListener("click", (event) => {
  if (event.target === deleteTripDialog) {
    closeDeleteTripDialog();
  }
});
deleteTripYes.addEventListener("click", confirmDeleteTrip);
document.addEventListener("keydown", handleDeleteTripShortcut);

bootstrap();

async function bootstrap() {
  await loadStatus();
  showAuthView();
}

async function loadStatus() {
  if (!statusText) {
    return;
  }

  try {
    const data = await fetchHealth();
    statusText.textContent = data.ok ? `${data.service} is running.` : "The API is offline.";
  } catch {
    statusText.textContent = "The API is offline.";
  }
}

function showAuthView() {
  clearAuthSession();
  activeTripId = null;
  authView.hidden = false;
  appView.hidden = true;
  detailSection.hidden = true;
  tripList.innerHTML = "";
  showAuthMode("login");
}

function showAppView(user) {
  renderCurrentUser(user);
  authView.hidden = true;
  appView.hidden = false;
}

function showAuthMode(mode) {
  const isRegister = mode === "register";

  loginForm.hidden = isRegister;
  registerForm.hidden = !isRegister;
  setFormError(loginError, "");
  setFormError(registerError, "");

  authTabs.forEach((tab) => {
    const isActive = tab.dataset.authMode === mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  if (!isRegister) {
    populateSavedLogin();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const rememberLogin = formData.get("rememberLogin") === "on";

  await submitAuthForm({
    form: loginForm,
    errorNode: loginError,
    submitText: "Log in",
    loadingText: "Logging in...",
    action: () => login({
      identifier: String(formData.get("identifier") || "").trim(),
      password: String(formData.get("password") || "")
    }),
    onSuccess: () => {
      saveLoginPreference({
        identifier: String(formData.get("identifier") || "").trim(),
        password: String(formData.get("password") || ""),
        rememberLogin
      });
    }
  });
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password !== confirmPassword) {
    setFormError(registerError, "Passwords do not match.");
    return;
  }

  await submitAuthForm({
    form: registerForm,
    errorNode: registerError,
    submitText: "Create account",
    loadingText: "Creating account...",
    action: () => register({
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password
    })
  });
}

async function submitAuthForm({
  form,
  errorNode,
  submitText,
  loadingText,
  action,
  onSuccess
}) {
  const submitButton = form.querySelector("button[type='submit']");
  setFormError(errorNode, "");
  submitButton.disabled = true;
  submitButton.textContent = loadingText;

  try {
    const authResult = await action();
    storeAuthSession(authResult);
    onSuccess?.(authResult);
    showAppView(authResult.user);
    await loadTrips();
  } catch (error) {
    setFormError(errorNode, error.message || "Unable to authenticate.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = submitText;
  }
}

function handleLogout() {
  clearAuthSession();
  closeProfileDialog();
  showAuthView();
}

function setFormError(node, message) {
  node.textContent = message;
  node.hidden = !message;
}

function populateSavedLogin() {
  const savedLogin = getSavedLogin();
  const identifierInput = loginForm.elements.identifier;
  const passwordInput = loginForm.elements.password;
  const rememberInput = loginForm.elements.rememberLogin;

  identifierInput.value = savedLogin?.identifier || "";
  passwordInput.value = savedLogin?.password || "";
  rememberInput.checked = Boolean(savedLogin);
  differentAccountButton.hidden = !savedLogin;
}

function saveLoginPreference({ identifier, password, rememberLogin }) {
  if (!rememberLogin) {
    window.localStorage.removeItem(SAVED_LOGIN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    SAVED_LOGIN_STORAGE_KEY,
    JSON.stringify({ identifier, password })
  );
}

function clearSavedLogin() {
  window.localStorage.removeItem(SAVED_LOGIN_STORAGE_KEY);
  loginForm.elements.identifier.value = "";
  loginForm.elements.password.value = "";
  loginForm.elements.rememberLogin.checked = false;
  differentAccountButton.hidden = true;
  loginForm.elements.identifier.focus();
}

function getSavedLogin() {
  try {
    const raw = window.localStorage.getItem(SAVED_LOGIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function openProfileDialog() {
  setFormError(profileError, "");
  const storedUser = getStoredCurrentUser();
  if (!storedUser) {
    return;
  }

  try {
    const { user } = await fetchCurrentUserProfile();
    storeCurrentUser(user);
    renderCurrentUser(user);
    populateProfileForm(user);
    profileDialog.hidden = false;
  } catch (error) {
    setFormError(profileError, error.message || "Unable to load profile.");
    populateProfileForm(storedUser);
    profileDialog.hidden = false;
  }
}

function closeProfileDialog() {
  profileDialog.hidden = true;
  closeAvatarViewDialog();
  setFormError(profileError, "");
  profileForm.reset();
}

function populateProfileForm(user) {
  profileAvatarDataUrl = user.avatarUrl || "";
  profileForm.elements.userId.value = getUserId(user);
  profileForm.elements.email.value = user.email || "";
  profileForm.elements.displayName.value = getDisplayName(user);
  profileForm.elements.avatarFile.value = "";
  renderProfilePreview({
    ...user,
    avatarUrl: profileAvatarDataUrl,
    displayName: profileForm.elements.displayName.value
  });
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const submitButton = profileForm.querySelector("button[type='submit']");
  const displayName = String(profileForm.elements.displayName.value || "").trim();

  if (!displayName) {
    setFormError(profileError, "Nickname is required.");
    return;
  }

  setFormError(profileError, "");
  submitButton.disabled = true;
  submitButton.textContent = "Saving...";

  try {
    const { user } = await updateCurrentUserProfile({
      displayName,
      avatarUrl: profileAvatarDataUrl
    });
    storeCurrentUser(user);
    renderCurrentUser(user);
    closeProfileDialog();
    if (activeTripId) {
      await refreshDetail();
    }
  } catch (error) {
    setFormError(profileError, error.message || "Unable to save profile.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save profile";
  }
}

async function handleAvatarFileChange(event) {
  const [file] = event.target.files;
  setFormError(profileError, "");

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    setFormError(profileError, "Please choose an image file.");
    event.target.value = "";
    return;
  }

  if (file.size > MAX_AVATAR_FILE_SIZE) {
    setFormError(profileError, "Profile photo must be 8 MB or smaller.");
    event.target.value = "";
    return;
  }

  try {
    profileAvatarDataUrl = await createCompressedAvatarDataUrl(file);
    renderProfilePreview({
      ...getStoredCurrentUser(),
      displayName: profileForm.elements.displayName.value,
      avatarUrl: profileAvatarDataUrl
    });
  } catch (error) {
    setFormError(profileError, error.message || "Unable to prepare profile photo.");
    event.target.value = "";
  }
}

function removeProfileAvatar() {
  profileAvatarDataUrl = "";
  profileForm.elements.avatarFile.value = "";
  renderProfilePreview({
    ...getStoredCurrentUser(),
    displayName: profileForm.elements.displayName.value,
    avatarUrl: ""
  });
}

function openAvatarViewDialog() {
  renderAvatar(avatarViewImage, avatarViewFallback, {
    ...getStoredCurrentUser(),
    displayName: profileForm.elements.displayName.value,
    avatarUrl: profileAvatarDataUrl
  });
  avatarViewDialog.hidden = false;
}

function closeAvatarViewDialog() {
  avatarViewDialog.hidden = true;
}

function renderCurrentUser(user) {
  currentUserName.textContent = getDisplayName(user);
  currentUserId.textContent = `@${getUserId(user)} · ${user.email}`;
  renderAvatar(currentUserAvatar, currentUserAvatarFallback, user);
}

function renderProfilePreview(user) {
  profilePreviewName.textContent = getDisplayName(user);
  profilePreviewId.textContent = `@${getUserId(user)} · ${user.email || ""}`;
  renderAvatar(profileAvatarPreview, profileAvatarFallback, user);
}

function renderAvatar(imageNode, fallbackNode, user) {
  const avatarUrl = user?.avatarUrl || "";
  const initials = getInitials(getDisplayName(user) || getUserId(user));
  fallbackNode.textContent = initials;

  if (avatarUrl) {
    imageNode.src = avatarUrl;
    imageNode.hidden = false;
    fallbackNode.hidden = true;
    return;
  }

  imageNode.removeAttribute("src");
  imageNode.hidden = true;
  fallbackNode.hidden = false;
}

function getDisplayName(user) {
  return String(user?.displayName || user?.name || "Traveler").trim();
}

function getUserId(user) {
  return String(user?.userId || user?.name || user?.id || "user").trim();
}

function getInitials(value) {
  const parts = String(value || "TS")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : parts[0]?.slice(0, 2) || "TS"
  ).toUpperCase();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Unable to read profile photo.")));
    reader.readAsDataURL(file);
  });
}

async function createCompressedAvatarDataUrl(file) {
  const sourceUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_IMAGE_SIZE;
  canvas.height = AVATAR_IMAGE_SIZE;

  const context = canvas.getContext("2d");
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max((image.naturalWidth - sourceSize) / 2, 0);
  const sourceY = Math.max((image.naturalHeight - sourceSize) / 2, 0);

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    AVATAR_IMAGE_SIZE,
    AVATAR_IMAGE_SIZE
  );

  return canvas.toDataURL("image/jpeg", AVATAR_IMAGE_QUALITY);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Unable to load profile photo.")), {
      once: true
    });
    image.src = src;
  });
}

async function loadTrips() {
  const { trips } = await fetchTrips();
  renderTrips(trips, tripList, { activeTripId, onSelect: openTrip });
  if (activeTripId && !trips.find((t) => t.id === activeTripId)) {
    closeDetail();
  } else if (activeTripId) {
    await refreshDetail();
  }
}

async function openTrip(tripId) {
  activeTripId = tripId;
  detailSection.hidden = false;
  document.querySelectorAll(".trip-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.tripId === tripId);
  });
  await refreshDetail();
  detailSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeDetail() {
  activeTripId = null;
  detailSection.hidden = true;
  closeDeleteTripDialog();
  document.querySelectorAll(".trip-card.is-active").forEach((c) => c.classList.remove("is-active"));
}

function openDeleteTripDialog() {
  const tripId = detailDelete.dataset.tripId || activeTripId;
  setDeleteTripError("");
  deleteTripDialog.dataset.tripId = tripId || "";
  deleteTripDialog.hidden = false;
}

function closeDeleteTripDialog() {
  deleteTripDialog.hidden = true;
  deleteTripDialog.dataset.tripId = "";
  setDeleteTripError("");
}

async function confirmDeleteTrip() {
  const tripId = deleteTripDialog.dataset.tripId || activeTripId;
  if (!tripId) {
    setDeleteTripError("No trip selected to delete.");
    return;
  }

  setDeleteTripError("");
  deleteTripYes.disabled = true;
  deleteTripYes.textContent = "Deleting...";
  try {
    await deleteTrip(tripId);
    activeTripId = null;
    closeDeleteTripDialog();
    detailSection.hidden = true;
    await loadTrips();
  } catch (error) {
    setDeleteTripError(error.message || "Unable to delete this trip.");
  } finally {
    deleteTripYes.disabled = false;
    deleteTripYes.textContent = "Yes, delete";
  }
}

function handleDeleteTripShortcut(event) {
  if (
    deleteTripDialog.hidden ||
    event.code !== "Space" ||
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    deleteTripYes.disabled
  ) {
    return;
  }

  event.preventDefault();
  confirmDeleteTrip();
}

function setDeleteTripError(message) {
  deleteTripError.textContent = message;
  deleteTripError.hidden = !message;
}

async function refreshDetail() {
  if (!activeTripId) return;
  const currentUser = getStoredCurrentUser();
  const [{ trip }, { balances }] = await Promise.all([
    fetchTrip(activeTripId),
    fetchBalances(activeTripId)
  ]);

  detailEyebrow.textContent = trip.destination ? `Trip · ${trip.destination}` : "Trip";
  detailTitle.textContent = trip.name;
  detailMeta.textContent = formatTripMeta(trip);
  detailParticipants.innerHTML = trip.participants
    .map((p) => {
      const cls = p.role === "organizer" ? "chip is-organizer" : "chip";
      return `<span class="${cls}">${escapeHtml(getDisplayName(p))}</span>`;
    })
    .join("");

  const isOrganizer = trip.organizerId === currentUser?.id;
  detailDelete.hidden = !isOrganizer;
  detailDelete.dataset.tripId = String(trip.id);
  renderBudget(budgetPanel, { trip, isOrganizer, onChange: loadTrips });
  renderExpenses(expensesPanel, { trip, currentUserId: currentUser?.id, onChange: loadTrips });
  renderBalances(balancesPanel, { balances, trip, currentUserId: currentUser?.id });
}

function formatTripMeta(trip) {
  const dates = trip.startDate && trip.endDate
    ? `${trip.startDate} → ${trip.endDate}`
    : trip.startDate || trip.endDate || "Dates TBD";
  return `${dates} · ${pluralize(trip.participants.length, "participant")}`;
}
