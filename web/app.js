import {
  clearAuthSession,
  deleteTrip,
  fetchBalances,
  fetchCurrentUserProfile,
  fetchFriendProfile,
  fetchFriendPublicTrips,
  fetchFriends,
  fetchHealth,
  fetchTrip,
  fetchTrips,
  getStoredCurrentUser,
  getStoredAuthToken,
  inviteParticipant,
  login,
  register,
  removeFriend,
  removeTripParticipant,
  requestTripJoin,
  respondToFriendRequest,
  respondToTripInvitation,
  respondToTripJoinRequest,
  searchUsersForFriend,
  sendFriendRequest,
  SESSION_EXPIRED_ERROR_MESSAGE,
  setUnauthorizedHandler,
  storeAuthSession,
  storeCurrentUser,
  updateCurrentUserProfile,
  updateTrip
} from "./api.js";
import { setupDateInputs, setupTripForm, validateTripDates } from "./forms.js";
import { renderBalances } from "./renderBalances.js";
import { renderBudget } from "./renderBudget.js";
import { renderExpenses } from "./renderExpenses.js";
import { escapeHtml, formatBudgetSummary, pluralize, renderTrips } from "./renderTrips.js";

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
const appShell = document.querySelector(".app-shell");
const mainTabButtons = Array.from(document.querySelectorAll("[data-main-tab]"));
const mainTabPanels = Array.from(document.querySelectorAll("[data-main-panel]"));
const tripLobbyList = document.querySelector("#trip-lobby-list");
const tripLobbyRefresh = document.querySelector("#trip-lobby-refresh");
const tripLobbyError = document.querySelector("#trip-lobby-error");
const createTripInviteButton = document.querySelector("#create-trip-invite-button");
const createTripInviteCount = document.querySelector("#create-trip-invite-count");
const detailSection = document.querySelector("#trip-detail");
const detailTitle = document.querySelector("#detail-title");
const detailMeta = document.querySelector("#detail-meta");
const detailParticipants = document.querySelector("#detail-participants");
const detailPendingInvitationsWrap = document.querySelector("#detail-pending-invitations-wrap");
const detailPendingInvitations = document.querySelector("#detail-pending-invitations");
const detailClose = document.querySelector("#detail-close");
const detailDelete = document.querySelector("#detail-delete");
const tripEditForm = document.querySelector("#trip-edit-form");
const tripInviteForm = document.querySelector("#trip-invite-form");
const tripInviteButton = document.querySelector("#trip-invite-button");
const tripRemoveParticipantButton = document.querySelector("#trip-remove-participant-button");
const tripEditError = document.querySelector("#trip-edit-error");
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
const friendsSidebar = document.querySelector("#friends-sidebar");
const friendsToggle = document.querySelector("#friends-toggle");
const addFriendButton = document.querySelector("#add-friend-button");
const friendsSearch = document.querySelector("#friends-search");
const friendsList = document.querySelector("#friends-list");
const friendRequestsButton = document.querySelector("#friend-requests-button");
const friendRequestsDot = document.querySelector("#friend-requests-dot");
const friendRequestsCount = document.querySelector("#friend-requests-count");
const addFriendDialog = document.querySelector("#add-friend-dialog");
const addFriendForm = document.querySelector("#add-friend-form");
const addFriendClose = document.querySelector("#add-friend-close");
const addFriendResults = document.querySelector("#add-friend-results");
const addFriendError = document.querySelector("#add-friend-error");
const friendRequestsDialog = document.querySelector("#friend-requests-dialog");
const friendRequestsClose = document.querySelector("#friend-requests-close");
const friendRequestsList = document.querySelector("#friend-requests-list");
const tripInvitationsList = document.querySelector("#trip-invitations-list");
const tripJoinRequestsList = document.querySelector("#trip-join-requests-list");
const requestTabButtons = Array.from(document.querySelectorAll("[data-request-tab]"));
const requestTabPanels = Array.from(document.querySelectorAll("[data-request-panel]"));
const friendRequestsError = document.querySelector("#friend-requests-error");
const friendProfileDialog = document.querySelector("#friend-profile-dialog");
const friendProfileClose = document.querySelector("#friend-profile-close");
const friendProfileName = document.querySelector("#friend-profile-name");
const friendProfileDisplayName = document.querySelector("#friend-profile-display-name");
const friendProfileId = document.querySelector("#friend-profile-id");
const friendProfileAvatar = document.querySelector("#friend-profile-avatar");
const friendProfileAvatarFallback = document.querySelector("#friend-profile-avatar-fallback");
const friendAvatarTrigger = document.querySelector("#friend-avatar-trigger");
const friendPublicTrips = document.querySelector("#friend-public-trips");
const friendProfileError = document.querySelector("#friend-profile-error");
const removeFriendButton = document.querySelector("#remove-friend-button");
const deleteFriendDialog = document.querySelector("#delete-friend-dialog");
const deleteFriendYes = document.querySelector("#delete-friend-yes");
const deleteFriendNo = document.querySelector("#delete-friend-no");
const deleteFriendError = document.querySelector("#delete-friend-error");
const joinTripDialog = document.querySelector("#join-trip-dialog");
const joinTripCopy = document.querySelector("#join-trip-copy");
const joinTripYes = document.querySelector("#join-trip-yes");
const joinTripNo = document.querySelector("#join-trip-no");
const joinTripError = document.querySelector("#join-trip-error");
const createTripInviteDialog = document.querySelector("#create-trip-invite-dialog");
const createTripInviteList = document.querySelector("#create-trip-invite-list");
const createTripInviteBack = document.querySelector("#create-trip-invite-back");
const createTripInviteDone = document.querySelector("#create-trip-invite-done");
const createTripInviteError = document.querySelector("#create-trip-invite-error");
const tripInviteDialog = document.querySelector("#trip-invite-dialog");
const tripInviteList = document.querySelector("#trip-invite-list");
const tripInviteBack = document.querySelector("#trip-invite-back");
const tripInviteSend = document.querySelector("#trip-invite-send");
const tripInviteError = document.querySelector("#trip-invite-error");
const tripRemoveParticipantDialog = document.querySelector("#trip-remove-participant-dialog");
const tripRemoveParticipantList = document.querySelector("#trip-remove-participant-list");
const tripRemoveParticipantBack = document.querySelector("#trip-remove-participant-back");
const tripRemoveParticipantSend = document.querySelector("#trip-remove-participant-send");
const tripRemoveParticipantError = document.querySelector("#trip-remove-participant-error");

let activeTripId = null;
let activeTripDetail = null;
let friendsState = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  tripJoinRequests: [],
  tripInvitations: []
};
let activeFriendProfile = null;
let pendingJoinTrip = null;
let activeMainTab = "trips";
let publicTripLobbyItems = [];
let createInviteFriends = [];
let selectedCreateInviteFriendIds = new Set();
let inviteableFriends = [];
let selectedInviteFriendIds = new Set();
let removableParticipants = [];
let selectedRemoveParticipantIds = new Set();
let profileAvatarDataUrl = "";
let activeRequestTab = "friends";
let highlightedTripInvitationId = null;
const SAVED_LOGIN_STORAGE_KEY = "tripsplit.savedLogin";
const UI_STATE_STORAGE_KEY = "tripsplit.uiState";
const MAX_AVATAR_FILE_SIZE = 8_000_000;
const AVATAR_IMAGE_SIZE = 256;
const AVATAR_IMAGE_QUALITY = 0.86;
const SESSION_EXPIRED_MESSAGE = SESSION_EXPIRED_ERROR_MESSAGE;
const APP_REFRESH_INTERVAL_MS = 5000;
let sessionExpiredHandled = false;
let appRefreshTimer = null;
let appRefreshInFlight = false;

setUnauthorizedHandler(handleSessionExpired);
setupDateInputs(document);

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
setupTripForm(tripForm, loadTrips, {
  getInviteeUserIds: () => Array.from(selectedCreateInviteFriendIds),
  onCreated: clearCreateTripInvites
});
mainTabButtons.forEach((button) => {
  button.addEventListener("click", () => switchMainTab(button.dataset.mainTab));
});
tripLobbyRefresh.addEventListener("click", loadFriendPublicTripLobby);
createTripInviteButton.addEventListener("click", openCreateTripInviteDialog);
createTripInviteBack.addEventListener("click", closeCreateTripInviteDialog);
createTripInviteDone.addEventListener("click", closeCreateTripInviteDialog);
createTripInviteDialog.addEventListener("click", (event) => {
  if (event.target === createTripInviteDialog) {
    closeCreateTripInviteDialog();
  }
});
tripEditForm.addEventListener("submit", handleTripEditSubmit);
tripInviteButton.addEventListener("click", openTripInviteDialog);
tripRemoveParticipantButton.addEventListener("click", openTripRemoveParticipantDialog);
tripInviteBack.addEventListener("click", closeTripInviteDialog);
tripInviteSend.addEventListener("click", sendTripInvites);
tripInviteDialog.addEventListener("click", (event) => {
  if (event.target === tripInviteDialog) {
    closeTripInviteDialog();
  }
});
tripRemoveParticipantBack.addEventListener("click", closeTripRemoveParticipantDialog);
tripRemoveParticipantSend.addEventListener("click", removeSelectedParticipants);
tripRemoveParticipantDialog.addEventListener("click", (event) => {
  if (event.target === tripRemoveParticipantDialog) {
    closeTripRemoveParticipantDialog();
  }
});
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
document.addEventListener("keydown", handleModalEscape);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshVisibleAppState();
  }
});
window.addEventListener("focus", refreshVisibleAppState);
friendsToggle.addEventListener("click", toggleFriendsSidebar);
friendsSearch.addEventListener("input", renderFriendsList);
addFriendButton.addEventListener("click", () => openAddFriendDialog());
addFriendClose.addEventListener("click", closeAddFriendDialog);
addFriendForm.addEventListener("submit", handleAddFriendSearch);
addFriendDialog.addEventListener("click", (event) => {
  if (event.target === addFriendDialog) {
    closeAddFriendDialog();
  }
});
friendRequestsButton.addEventListener("click", () => openFriendRequestsDialog());
friendRequestsClose.addEventListener("click", closeFriendRequestsDialog);
requestTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeRequestTab = button.dataset.requestTab;
    renderRequestTabs();
    storeUiState();
  });
});
friendRequestsDialog.addEventListener("click", (event) => {
  if (event.target === friendRequestsDialog) {
    closeFriendRequestsDialog();
  }
});
friendProfileClose.addEventListener("click", closeFriendProfileDialog);
friendProfileDialog.addEventListener("click", (event) => {
  if (event.target === friendProfileDialog) {
    closeFriendProfileDialog();
  }
});
friendAvatarTrigger.addEventListener("click", openFriendAvatarViewDialog);
removeFriendButton.addEventListener("click", openDeleteFriendDialog);
deleteFriendNo.addEventListener("click", closeDeleteFriendDialog);
deleteFriendYes.addEventListener("click", confirmDeleteFriend);
deleteFriendDialog.addEventListener("click", (event) => {
  if (event.target === deleteFriendDialog) {
    closeDeleteFriendDialog();
  }
});
joinTripNo.addEventListener("click", closeJoinTripDialog);
joinTripYes.addEventListener("click", confirmJoinTripRequest);
joinTripDialog.addEventListener("click", (event) => {
  if (event.target === joinTripDialog) {
    closeJoinTripDialog();
  }
});

bootstrap();

async function bootstrap() {
  await loadStatus();
  await restoreAuthSession();
  document.body.classList.remove("is-booting");
}

async function restoreAuthSession() {
  if (!getStoredAuthToken()) {
    showAuthView();
    return;
  }

  const savedUiState = getStoredUiState();

  try {
    const { user } = await fetchCurrentUserProfile({ skipUnauthorizedHandler: true });
    storeCurrentUser(user);
    showAppView(user);
    switchMainTab(savedUiState.activeMainTab, { skipLoad: true, skipPersist: true });
    await loadFriends();
    activeTripId = savedUiState.activeTripId || null;
    detailSection.hidden = !activeTripId;
    await loadTrips();
    if (activeMainTab === "lobby") {
      await loadFriendPublicTripLobby();
    }
    await restoreUiOverlay(savedUiState);
    storeUiState();
  } catch (error) {
    const message = error.status === 401
      ? SESSION_EXPIRED_MESSAGE
      : "Unable to restore your session. Please log in again.";
    showAuthView(message);
  }
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

function showAuthView(message = "") {
  stopAppAutoRefresh();
  clearAuthSession();
  clearUiState();
  closeAuthenticatedDialogs();
  activeTripId = null;
  activeTripDetail = null;
  friendsState = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    tripJoinRequests: [],
    tripInvitations: []
  };
  activeFriendProfile = null;
  pendingJoinTrip = null;
  publicTripLobbyItems = [];
  switchMainTab("trips", { skipLoad: true });
  clearCreateTripInvites();
  authView.hidden = false;
  appView.hidden = true;
  detailSection.hidden = true;
  tripList.innerHTML = "";
  friendsList.innerHTML = "";
  showAuthMode("login");
  if (message) {
    setFormError(loginError, message);
  }
}

function closeAuthenticatedDialogs() {
  [
    profileDialog,
    avatarViewDialog,
    addFriendDialog,
    friendRequestsDialog,
    friendProfileDialog,
    joinTripDialog,
    createTripInviteDialog,
    tripInviteDialog,
    tripRemoveParticipantDialog,
    deleteTripDialog,
    deleteFriendDialog
  ].forEach((dialog) => {
    if (dialog) {
      dialog.hidden = true;
    }
  });
}

function showAppView(user) {
  sessionExpiredHandled = false;
  renderCurrentUser(user);
  authView.hidden = true;
  appView.hidden = false;
  startAppAutoRefresh();
}

function startAppAutoRefresh() {
  stopAppAutoRefresh();
  appRefreshTimer = window.setInterval(refreshVisibleAppState, APP_REFRESH_INTERVAL_MS);
}

function stopAppAutoRefresh() {
  if (appRefreshTimer) {
    window.clearInterval(appRefreshTimer);
  }
  appRefreshTimer = null;
  appRefreshInFlight = false;
}

async function refreshVisibleAppState() {
  if (shouldSkipAppRefresh()) {
    return;
  }

  appRefreshInFlight = true;
  try {
    await loadFriends();
    await loadTrips();
    if (activeMainTab === "lobby") {
      await loadFriendPublicTripLobby();
    }
  } catch {
    // Background refresh should not interrupt the current view; explicit actions still show errors.
  } finally {
    appRefreshInFlight = false;
  }
}

function shouldSkipAppRefresh() {
  return (
    appView.hidden ||
    document.hidden ||
    appRefreshInFlight ||
    hasOpenModal() ||
    isEditingFormField()
  );
}

function hasOpenModal() {
  return Boolean(document.querySelector(".modal-overlay:not([hidden])"));
}

function isEditingFormField() {
  const activeElement = document.activeElement;
  return Boolean(
    activeElement &&
    activeElement.closest("form") &&
    activeElement.matches("input, textarea, select")
  );
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
    await loadFriends();
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
  clearUiState();
  closeProfileDialog();
  closeAddFriendDialog();
  closeFriendRequestsDialog();
  closeFriendProfileDialog();
  closeJoinTripDialog();
  closeTripInviteDialog();
  showAuthView();
}

function handleSessionExpired() {
  if (sessionExpiredHandled) {
    return;
  }

  sessionExpiredHandled = true;
  showAuthView(SESSION_EXPIRED_MESSAGE);
}

function setFormError(node, message) {
  node.textContent = message;
  node.hidden = !message;
}

function isSessionExpiredError(error) {
  return error?.status === 401;
}

function getStoredUiState() {
  try {
    const raw = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      activeMainTab: parsed.activeMainTab === "lobby" ? "lobby" : "trips",
      activeTripId: parsed.activeTripId ? String(parsed.activeTripId) : null,
      activeOverlay: getValidOverlayName(parsed.activeOverlay),
      activeRequestTab: getValidRequestTab(parsed.activeRequestTab),
      activeFriendProfileId: parsed.activeFriendProfileId
        ? String(parsed.activeFriendProfileId)
        : null
    };
  } catch {
    return {
      activeMainTab: "trips",
      activeTripId: null,
      activeOverlay: null,
      activeRequestTab: "friends",
      activeFriendProfileId: null
    };
  }
}

function storeUiState() {
  if (!getStoredAuthToken()) {
    return;
  }

  window.localStorage.setItem(
    UI_STATE_STORAGE_KEY,
    JSON.stringify({
      activeMainTab,
      activeTripId,
      activeRequestTab,
      ...getActiveOverlayState()
    })
  );
}

function clearUiState() {
  window.localStorage.removeItem(UI_STATE_STORAGE_KEY);
}

function getValidOverlayName(overlayName) {
  return ["profile", "addFriend", "requests", "friendProfile"].includes(overlayName)
    ? overlayName
    : null;
}

function getValidRequestTab(tabName) {
  return ["friends", "invitations", "joins"].includes(tabName) ? tabName : "friends";
}

function getActiveOverlayState() {
  if (profileDialog && !profileDialog.hidden) {
    return { activeOverlay: "profile" };
  }

  if (addFriendDialog && !addFriendDialog.hidden) {
    return { activeOverlay: "addFriend" };
  }

  if (friendRequestsDialog && !friendRequestsDialog.hidden) {
    return {
      activeOverlay: "requests",
      activeRequestTab
    };
  }

  if (friendProfileDialog && !friendProfileDialog.hidden && activeFriendProfile?.friend?.id) {
    return {
      activeOverlay: "friendProfile",
      activeFriendProfileId: String(activeFriendProfile.friend.id)
    };
  }

  return {
    activeOverlay: null,
    activeFriendProfileId: null
  };
}

async function restoreUiOverlay(savedUiState) {
  if (savedUiState.activeOverlay === "profile") {
    await openProfileDialog({ skipPersist: true });
    return;
  }

  if (savedUiState.activeOverlay === "addFriend") {
    openAddFriendDialog({ skipPersist: true });
    return;
  }

  if (savedUiState.activeOverlay === "requests") {
    openFriendRequestsDialog({
      tab: savedUiState.activeRequestTab,
      skipPersist: true
    });
    return;
  }

  if (savedUiState.activeOverlay === "friendProfile" && savedUiState.activeFriendProfileId) {
    await openFriendProfile(savedUiState.activeFriendProfileId, { skipPersist: true });
  }
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

async function openProfileDialog(options = {}) {
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
    if (!options.skipPersist) {
      storeUiState();
    }
  } catch (error) {
    if (isSessionExpiredError(error)) {
      return;
    }

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
  storeUiState();
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
  openAvatarPreview({
    ...getStoredCurrentUser(),
    displayName: profileForm.elements.displayName.value,
    avatarUrl: profileAvatarDataUrl
  });
}

function openFriendAvatarViewDialog() {
  if (!activeFriendProfile?.friend) {
    return;
  }

  openAvatarPreview(activeFriendProfile.friend);
}

function openAvatarPreview(user) {
  renderAvatar(avatarViewImage, avatarViewFallback, user);
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

async function loadFriends() {
  try {
    friendsState = await fetchFriends();
    renderFriendsList();
    renderFriendRequestIndicator();
    if (!friendRequestsDialog.hidden) {
      renderFriendRequestsDialog();
    }
  } catch {
    friendsState = {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      tripJoinRequests: [],
      tripInvitations: []
    };
    renderFriendsList();
    renderFriendRequestIndicator();
  }
}

function switchMainTab(tabName, options = {}) {
  const nextTab = tabName === "lobby" ? "lobby" : "trips";
  activeMainTab = nextTab;

  mainTabButtons.forEach((button) => {
    const isActive = button.dataset.mainTab === activeMainTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  mainTabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.mainPanel !== activeMainTab;
  });

  if (activeMainTab === "lobby" && !options.skipLoad) {
    loadFriendPublicTripLobby();
  }

  if (!options.skipPersist) {
    storeUiState();
  }
}

async function loadFriendPublicTripLobby() {
  setFormError(tripLobbyError, "");
  tripLobbyList.innerHTML = `<p class="empty">Loading public trips...</p>`;
  tripLobbyRefresh.disabled = true;

  try {
    const { publicTrips } = await fetchFriendPublicTrips();
    publicTripLobbyItems = publicTrips || [];
    renderFriendPublicTripLobby();
  } catch (error) {
    publicTripLobbyItems = [];
    tripLobbyList.innerHTML = "";
    setFormError(tripLobbyError, error.message || "Unable to load trip lobby.");
  } finally {
    tripLobbyRefresh.disabled = false;
  }
}

function renderFriendPublicTripLobby() {
  setFormError(tripLobbyError, "");

  if (!publicTripLobbyItems.length) {
    tripLobbyList.innerHTML = `
      <p class="empty">No public friend trips yet. Add friends or ask them to make a trip public.</p>
    `;
    return;
  }

  tripLobbyList.innerHTML = publicTripLobbyItems
    .map((trip) => renderTripLobbyCard(trip))
    .join("");

  tripLobbyList.querySelectorAll("[data-request-join-trip]").forEach((node) => {
    node.addEventListener("click", () => openJoinTripDialog(node.dataset.requestJoinTrip));
  });

  tripLobbyList.querySelectorAll("[data-open-trip-invitation]").forEach((node) => {
    node.addEventListener("click", () =>
      openTripInvitationFromLobby(node.dataset.openTripInvitation)
    );
  });

  tripLobbyList.querySelectorAll("[data-open-lobby-friend]").forEach((node) => {
    node.addEventListener("click", () => openFriendProfile(node.dataset.openLobbyFriend));
  });

  tripLobbyList.querySelectorAll("[data-avatar-preview-user]").forEach((node) => {
    node.addEventListener("click", () => {
      const user = findUserInFriendsState(node.dataset.avatarPreviewUser);
      if (user) {
        openAvatarPreview(user);
      }
    });
  });
}

function renderTripLobbyCard(trip) {
  const organizer = trip.organizer || {};
  const organizerName = trip.organizerName || getDisplayName(organizer) || "Organizer";
  const destination = trip.destination || trip.name || "Trip";

  return `
    <article class="trip-lobby-card">
      <div class="trip-lobby-card-main">
        <div class="trip-card-title-group">
          <strong>${escapeHtml(destination)}</strong>
          <span class="trip-organizer-chip">
            <span>${escapeHtml(organizerName)}</span>
            <span class="trip-organizer-role">organizer</span>
          </span>
          ${renderAvatarPreviewMarkup(organizer)}
        </div>
        <div class="trip-lobby-card-content">
          <div class="trip-lobby-meta">
            <div class="trip-card-meta">${escapeHtml(formatTripDates(trip.startDate, trip.endDate))}</div>
            <div class="trip-card-meta">${pluralize(trip.participantCount, "participant")} · ${escapeHtml(formatBudgetSummary(trip.budgetSummary))}</div>
          </div>
          <div class="trip-lobby-side">
            ${renderJoinTripAction(trip, { display: "button" })}
          </div>
        </div>
      </div>
    </article>
  `;
}

function toggleFriendsSidebar() {
  friendsSidebar.classList.toggle("is-collapsed");
  const isCollapsed = friendsSidebar.classList.contains("is-collapsed");
  appShell.classList.toggle("is-sidebar-collapsed", isCollapsed);
  friendsToggle.textContent = isCollapsed ? "›" : "‹";
  friendsToggle.setAttribute(
    "aria-label",
    isCollapsed ? "Expand friends" : "Collapse friends"
  );
}

function renderFriendsList() {
  const query = String(friendsSearch.value || "").trim().toLowerCase();
  const friends = (friendsState.friends || []).filter((friend) =>
    [getDisplayName(friend), getUserId(friend), friend.email]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  );

  if (!friends.length) {
    friendsList.innerHTML = `<p class="empty friend-empty">${query ? "No matching friends." : "No friends yet."}</p>`;
    return;
  }

  friendsList.innerHTML = friends
    .map((friend) => `
      <div class="friend-row" data-friend-id="${escapeHtml(friend.id)}">
        <button type="button" class="friend-avatar-button" data-open-friend="${escapeHtml(friend.id)}" aria-label="Open ${escapeHtml(getDisplayName(friend))}">
          ${renderAvatarMarkup(friend)}
        </button>
        <button type="button" class="friend-row-main" data-open-friend="${escapeHtml(friend.id)}">
          <strong>${escapeHtml(getDisplayName(friend))}</strong>
          <span>@${escapeHtml(getUserId(friend))}</span>
        </button>
      </div>
    `)
    .join("");

  friendsList.querySelectorAll("[data-open-friend]").forEach((node) => {
    node.addEventListener("click", () => openFriendProfile(node.dataset.openFriend));
  });
}

function renderFriendRequestIndicator() {
  const count =
    (friendsState.incomingRequests || []).length +
    (friendsState.tripJoinRequests || []).length +
    (friendsState.tripInvitations || []).length;
  friendRequestsCount.textContent = String(count);
  friendRequestsDot.hidden = count === 0;
  friendRequestsButton.classList.toggle("has-requests", count > 0);
}

function openAddFriendDialog(options = {}) {
  setFormError(addFriendError, "");
  addFriendForm.reset();
  addFriendResults.innerHTML = `<p class="empty">Search by full User ID or email.</p>`;
  addFriendDialog.hidden = false;
  if (!options.skipPersist) {
    storeUiState();
  }
  addFriendForm.elements.identifier.focus();
}

function closeAddFriendDialog() {
  addFriendDialog.hidden = true;
  setFormError(addFriendError, "");
  addFriendResults.innerHTML = "";
  storeUiState();
}

async function handleAddFriendSearch(event) {
  event.preventDefault();
  const identifier = String(addFriendForm.elements.identifier.value || "").trim();

  if (!identifier) {
    return;
  }

  setFormError(addFriendError, "");
  addFriendResults.innerHTML = `<p class="empty">Searching...</p>`;

  try {
    const { users } = await searchUsersForFriend(identifier);
    renderAddFriendResults(users);
  } catch (error) {
    setFormError(addFriendError, error.message || "Unable to search users.");
    addFriendResults.innerHTML = "";
  }
}

function renderAddFriendResults(users) {
  if (!users.length) {
    addFriendResults.innerHTML = `<p class="empty">No user found.</p>`;
    return;
  }

  addFriendResults.innerHTML = users
    .map((user) => {
      const actionLabel = getFriendActionLabel(user.relationship);
      const disabled = actionLabel !== "Add";

      return `
        <div class="friend-result" data-user-id="${escapeHtml(user.id)}">
          ${renderAvatarMarkup(user)}
          <div>
            <strong>${escapeHtml(getDisplayName(user))}</strong>
            <p class="hint">@${escapeHtml(getUserId(user))} · ${escapeHtml(user.email || "")}</p>
          </div>
          <button type="button" data-add-friend="${escapeHtml(getUserId(user))}" ${disabled ? "disabled" : ""}>
            ${actionLabel}
          </button>
        </div>
      `;
    })
    .join("");

  addFriendResults.querySelectorAll("[data-add-friend]").forEach((node) => {
    node.addEventListener("click", () => handleSendFriendRequest(node.dataset.addFriend));
  });
}

async function handleSendFriendRequest(identifier) {
  setFormError(addFriendError, "");

  try {
    await sendFriendRequest(identifier);
    await loadFriends();
    addFriendResults.innerHTML = `<p class="empty">Friend request sent.</p>`;
  } catch (error) {
    setFormError(addFriendError, error.message || "Unable to send friend request.");
  }
}

function openFriendRequestsDialog(options = {}) {
  setFormError(friendRequestsError, "");
  highlightedTripInvitationId = options.highlightTripInvitationId
    ? String(options.highlightTripInvitationId)
    : null;
  activeRequestTab = options.tab || getDefaultRequestTab();
  renderFriendRequestsDialog();
  friendRequestsDialog.hidden = false;
  scrollHighlightedTripInvitation();
  if (!options.skipPersist) {
    storeUiState();
  }
}

function closeFriendRequestsDialog() {
  friendRequestsDialog.hidden = true;
  highlightedTripInvitationId = null;
  setFormError(friendRequestsError, "");
  storeUiState();
}

function renderFriendRequestsDialog() {
  const incoming = friendsState.incomingRequests || [];
  const tripRequests = friendsState.tripJoinRequests || [];
  const tripInvitations = sortTripInvitationsForHighlight(friendsState.tripInvitations || []);
  const counts = getRequestTabCounts();

  friendRequestsList.innerHTML = `
    ${incoming.length ? incoming.map(renderIncomingFriendRequest).join("") : `<p class="empty">No friend requests.</p>`}
  `;
  tripInvitationsList.innerHTML = `
    ${tripInvitations.length ? tripInvitations.map(renderIncomingTripInvitation).join("") : `<p class="empty">No trip invitations.</p>`}
  `;
  tripJoinRequestsList.innerHTML = `
    ${tripRequests.length ? tripRequests.map(renderIncomingTripJoinRequest).join("") : `<p class="empty">No trip join requests.</p>`}
  `;
  normalizeActiveRequestTab(counts);
  renderRequestTabs(counts);

  friendRequestsList.querySelectorAll("[data-friend-request-action]").forEach((node) => {
    node.addEventListener("click", () =>
      handleFriendRequestAction(node.dataset.requestId, node.dataset.friendRequestAction)
    );
  });
  tripInvitationsList.querySelectorAll("[data-trip-invitation-action]").forEach((node) => {
    node.addEventListener("click", () =>
      handleTripInvitationAction(node.dataset.tripId, node.dataset.tripInvitationAction)
    );
  });
  tripJoinRequestsList.querySelectorAll("[data-trip-request-action]").forEach((node) => {
    node.addEventListener("click", () =>
      handleTripJoinRequestAction(node.dataset.requestId, node.dataset.tripRequestAction)
    );
  });
  friendRequestsDialog.querySelectorAll("[data-avatar-preview-user]").forEach((node) => {
    node.addEventListener("click", () => {
      const user = findUserInFriendsState(node.dataset.avatarPreviewUser);
      if (user) {
        openAvatarPreview(user);
      }
    });
  });

  scrollHighlightedTripInvitation();
}

function sortTripInvitationsForHighlight(invitations) {
  if (!highlightedTripInvitationId) {
    return invitations;
  }

  return [...invitations].sort((a, b) => {
    const aMatches = String(a.tripId || a.id) === highlightedTripInvitationId;
    const bMatches = String(b.tripId || b.id) === highlightedTripInvitationId;
    return Number(bMatches) - Number(aMatches);
  });
}

function scrollHighlightedTripInvitation() {
  if (!highlightedTripInvitationId || activeRequestTab !== "invitations") {
    return;
  }

  window.requestAnimationFrame(() => {
    const target = Array.from(
      tripInvitationsList.querySelectorAll("[data-trip-invitation-card]")
    ).find((node) => node.dataset.tripInvitationCard === highlightedTripInvitationId);

    target?.scrollIntoView({ block: "start" });
  });
}

function getRequestTabCounts() {
  return {
    friends: (friendsState.incomingRequests || []).length,
    invitations: (friendsState.tripInvitations || []).length,
    joins: (friendsState.tripJoinRequests || []).length
  };
}

function getDefaultRequestTab() {
  const counts = getRequestTabCounts();

  if (counts.friends > 0) return "friends";
  if (counts.invitations > 0) return "invitations";
  if (counts.joins > 0) return "joins";
  return "friends";
}

function normalizeActiveRequestTab(counts) {
  if (Object.hasOwn(counts, activeRequestTab)) {
    return;
  }

  activeRequestTab = getDefaultRequestTab();
}

function renderRequestTabs(counts = getRequestTabCounts()) {
  requestTabButtons.forEach((button) => {
    const isActive = button.dataset.requestTab === activeRequestTab;
    const countNode = button.querySelector("[data-request-tab-count]");

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("role", "tab");
    if (countNode) {
      countNode.textContent = String(counts[button.dataset.requestTab] || 0);
    }
  });

  requestTabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.requestPanel !== activeRequestTab;
  });
}

function renderIncomingFriendRequest(request) {
  return `
    <div class="request-card request-card-stacked">
      ${renderAvatarPreviewMarkup(request.requester)}
      <div class="request-copy">
        <strong>${escapeHtml(getDisplayName(request.requester))}</strong>
        <p class="hint">@${escapeHtml(getUserId(request.requester))}</p>
        <div class="request-actions">
          <button type="button" data-request-id="${escapeHtml(request.id)}" data-friend-request-action="accept">Accept</button>
          <button type="button" class="button-ghost" data-request-id="${escapeHtml(request.id)}" data-friend-request-action="decline">Decline</button>
        </div>
      </div>
    </div>
  `;
}

function renderIncomingTripJoinRequest(request) {
  const trip = request.trip || {};
  const destination = trip.destination || trip.name || "TBD";
  const organizerName = getTripOrganizerName(trip);

  return `
    <div class="request-card request-card-stacked">
      ${renderAvatarPreviewMarkup(request.requester)}
      <div class="request-copy">
        <strong>${escapeHtml(getDisplayName(request.requester))}</strong>
        <p class="hint">Wants to join your trip</p>
        <div class="request-trip-summary">
          <strong>Destination: ${escapeHtml(destination)}</strong>
          <span>Dates: ${escapeHtml(formatTripDates(trip.startDate, trip.endDate))}</span>
          <span>Organizer: ${escapeHtml(organizerName)}</span>
        </div>
        <div class="request-actions">
          <button type="button" data-request-id="${escapeHtml(request.id)}" data-trip-request-action="accept">Accept</button>
          <button type="button" class="button-ghost" data-request-id="${escapeHtml(request.id)}" data-trip-request-action="decline">Decline</button>
        </div>
      </div>
    </div>
  `;
}

function renderIncomingTripInvitation(invitation) {
  const organizer = invitation.organizer || {};
  const trip = invitation.trip || {};
  const destination = trip.destination || trip.name || "TBD";
  const tripId = invitation.tripId || invitation.id;
  const organizerName = getTripOrganizerName(trip, getDisplayName(organizer));

  return `
    <div class="request-card request-card-stacked" data-trip-invitation-card="${escapeHtml(tripId)}">
      ${renderAvatarPreviewMarkup(organizer)}
      <div class="request-copy">
        <strong>${escapeHtml(getDisplayName(organizer))}</strong>
        <p class="hint">Wants to invite you</p>
        <div class="request-trip-summary">
          <strong>Destination: ${escapeHtml(destination)}</strong>
          <span>Dates: ${escapeHtml(formatTripDates(trip.startDate, trip.endDate))}</span>
          <span>Organizer: ${escapeHtml(organizerName)}</span>
        </div>
        <div class="request-actions">
          <button type="button" data-trip-id="${escapeHtml(tripId)}" data-trip-invitation-action="accept">Accept</button>
          <button type="button" class="button-ghost" data-trip-id="${escapeHtml(tripId)}" data-trip-invitation-action="decline">Decline</button>
        </div>
      </div>
    </div>
  `;
}

function getTripOrganizerName(trip, fallback = "Organizer") {
  return trip?.organizerName || getDisplayName(trip?.organizer) || fallback;
}

async function handleFriendRequestAction(requestId, action) {
  setFormError(friendRequestsError, "");

  try {
    await respondToFriendRequest(requestId, action);
    await loadFriends();
  } catch (error) {
    setFormError(friendRequestsError, error.message || "Unable to update request.");
  }
}

async function handleTripJoinRequestAction(requestId, action) {
  setFormError(friendRequestsError, "");

  try {
    await respondToTripJoinRequest(requestId, action);
    await loadFriends();
    await loadTrips();
  } catch (error) {
    setFormError(friendRequestsError, error.message || "Unable to update trip request.");
  }
}

async function handleTripInvitationAction(tripId, action) {
  setFormError(friendRequestsError, "");

  try {
    await respondToTripInvitation(tripId, action);
    if (String(highlightedTripInvitationId || "") === String(tripId || "")) {
      highlightedTripInvitationId = null;
    }
    await loadFriends();
    await loadTrips();
    if (activeMainTab === "lobby") {
      await loadFriendPublicTripLobby();
    }
  } catch (error) {
    setFormError(friendRequestsError, error.message || "Unable to update trip invitation.");
  }
}

async function openTripInvitationFromLobby(tripId) {
  highlightedTripInvitationId = String(tripId || "");
  activeRequestTab = "invitations";
  setFormError(friendRequestsError, "");
  friendRequestsDialog.hidden = false;
  renderFriendRequestsDialog();

  try {
    await loadFriends();
    activeRequestTab = "invitations";
    renderFriendRequestsDialog();
  } catch (error) {
    setFormError(friendRequestsError, error.message || "Unable to load trip invitations.");
  }
}

async function openFriendProfile(friendId, options = {}) {
  setFormError(friendProfileError, "");
  friendPublicTrips.innerHTML = `<p class="empty">Loading...</p>`;
  friendProfileDialog.hidden = false;

  try {
    activeFriendProfile = await fetchFriendProfile(friendId);
    renderFriendProfile(activeFriendProfile);
    if (!options.skipPersist) {
      storeUiState();
    }
  } catch (error) {
    setFormError(friendProfileError, error.message || "Unable to load friend profile.");
    friendPublicTrips.innerHTML = "";
  }
}

function renderFriendProfile(profile) {
  const { friend, publicTrips } = profile;
  friendProfileName.textContent = getDisplayName(friend);
  friendProfileDisplayName.textContent = getDisplayName(friend);
  friendProfileId.textContent = `@${getUserId(friend)} · ${friend.email || ""}`;
  renderAvatar(friendProfileAvatar, friendProfileAvatarFallback, friend);

  if (!publicTrips.length) {
    friendPublicTrips.innerHTML = `<p class="empty">No public trips yet.</p>`;
    return;
  }

  friendPublicTrips.innerHTML = publicTrips
    .map((trip) => `
      <div class="friend-trip-card">
        <div>
          <strong>${escapeHtml(trip.destination || trip.name || "Trip")}</strong>
          <p class="hint">${escapeHtml(formatTripDates(trip.startDate, trip.endDate))} · ${pluralize(trip.participantCount, "participant")} · ${escapeHtml(formatBudgetSummary(trip.budgetSummary))}</p>
        </div>
        ${renderJoinTripAction(trip)}
      </div>
    `)
    .join("");

  friendPublicTrips.querySelectorAll("[data-request-join-trip]").forEach((node) => {
    node.addEventListener("click", () => openJoinTripDialog(node.dataset.requestJoinTrip));
  });
}

function renderJoinTripAction(trip, options = {}) {
  if (options.display === "button") {
    if (trip.isParticipant) {
      return `<button type="button" class="trip-lobby-state-button is-disabled" disabled>Joined</button>`;
    }

    if (trip.invitationStatus === "pending") {
      return `
        <button type="button" class="trip-lobby-state-button" data-open-trip-invitation="${escapeHtml(trip.id)}">
          Invited
        </button>
      `;
    }

    if (trip.joinRequestStatus === "pending") {
      return `<button type="button" class="trip-lobby-state-button is-disabled" disabled>Pending</button>`;
    }

    return `
      <button type="button" class="trip-lobby-state-button" data-request-join-trip="${escapeHtml(trip.id)}" aria-label="Request to join ${escapeHtml(trip.destination || trip.name || "trip")}">
        Request
      </button>
    `;
  }

  if (trip.isParticipant) {
    return `<span class="status-pill">Joined</span>`;
  }

  if (trip.invitationStatus === "pending") {
    return `<span class="status-pill">Invited</span>`;
  }

  if (trip.joinRequestStatus === "pending") {
    return `<span class="status-pill">Pending</span>`;
  }

  return `
    <button type="button" class="round-add-button" data-request-join-trip="${escapeHtml(trip.id)}" aria-label="Request to join ${escapeHtml(trip.name)}">
      +
    </button>
  `;
}

function closeFriendProfileDialog() {
  friendProfileDialog.hidden = true;
  activeFriendProfile = null;
  closeDeleteFriendDialog();
  setFormError(friendProfileError, "");
  friendPublicTrips.innerHTML = "";
  storeUiState();
}

function openDeleteFriendDialog() {
  if (!activeFriendProfile?.friend) {
    return;
  }

  setDeleteFriendError("");
  deleteFriendDialog.hidden = false;
}

function closeDeleteFriendDialog() {
  deleteFriendDialog.hidden = true;
  setDeleteFriendError("");
  deleteFriendYes.disabled = false;
  deleteFriendYes.textContent = "Yes, remove";
}

async function confirmDeleteFriend() {
  if (!activeFriendProfile?.friend) {
    return;
  }

  setDeleteFriendError("");
  setFormError(friendProfileError, "");
  deleteFriendYes.disabled = true;
  deleteFriendYes.textContent = "Removing...";

  try {
    await removeFriend(activeFriendProfile.friend.id);
    closeDeleteFriendDialog();
    closeFriendProfileDialog();
    await loadFriends();
  } catch (error) {
    setDeleteFriendError(error.message || "Unable to remove friend.");
    deleteFriendYes.disabled = false;
    deleteFriendYes.textContent = "Yes, remove";
  }
}

function setDeleteFriendError(message) {
  deleteFriendError.textContent = message;
  deleteFriendError.hidden = !message;
}

function openJoinTripDialog(tripId) {
  const trip = findRequestablePublicTrip(tripId);
  if (!trip) {
    return;
  }

  pendingJoinTrip = trip;
  setFormError(joinTripError, "");
  joinTripCopy.textContent = `Send a request to join ${trip.destination || trip.name}?`;
  joinTripDialog.hidden = false;
}

function closeJoinTripDialog() {
  joinTripDialog.hidden = true;
  pendingJoinTrip = null;
  setFormError(joinTripError, "");
}

async function confirmJoinTripRequest() {
  if (!pendingJoinTrip) {
    return;
  }

  joinTripYes.disabled = true;
  joinTripYes.textContent = "Requesting...";

  try {
    await requestTripJoin(pendingJoinTrip.id);
    closeJoinTripDialog();
    if (activeFriendProfile?.friend) {
      activeFriendProfile = await fetchFriendProfile(activeFriendProfile.friend.id);
      renderFriendProfile(activeFriendProfile);
    }
    if (activeMainTab === "lobby") {
      await loadFriendPublicTripLobby();
    }
  } catch (error) {
    setFormError(joinTripError, error.message || "Unable to request this trip.");
  } finally {
    joinTripYes.disabled = false;
    joinTripYes.textContent = "Yes, request";
  }
}

function findRequestablePublicTrip(tripId) {
  const id = String(tripId || "");
  const trip = (
    activeFriendProfile?.publicTrips?.find((entry) => String(entry.id) === id) ||
    publicTripLobbyItems.find((entry) => String(entry.id) === id)
  );

  if (
    !trip ||
    trip.isParticipant ||
    trip.invitationStatus === "pending" ||
    trip.joinRequestStatus === "pending"
  ) {
    return null;
  }

  return trip;
}

function renderAvatarMarkup(user) {
  const avatarUrl = user?.avatarUrl || "";
  const initials = escapeHtml(getInitials(getDisplayName(user) || getUserId(user)));

  if (avatarUrl) {
    return `<img class="avatar-image" src="${escapeHtml(avatarUrl)}" alt="" />`;
  }

  return `<span class="avatar-fallback">${initials}</span>`;
}

function renderAvatarPreviewMarkup(user) {
  return `
    <button type="button" class="avatar-preview-button" data-avatar-preview-user="${escapeHtml(user?.id || "")}" aria-label="Preview ${escapeHtml(getDisplayName(user))} avatar">
      ${renderAvatarMarkup(user)}
    </button>
  `;
}

function findUserInFriendsState(userId) {
  const id = String(userId || "");
  const candidates = [
    ...(friendsState.friends || []),
    ...(friendsState.incomingRequests || []).flatMap((request) => [
      request.requester,
      request.recipient
    ]),
    ...(friendsState.outgoingRequests || []).flatMap((request) => [
      request.requester,
      request.recipient
    ]),
    ...(friendsState.tripJoinRequests || []).map((request) => request.requester),
    ...(friendsState.tripInvitations || []).flatMap((invitation) => [
      invitation.organizer,
      invitation.invitee
    ]),
    ...publicTripLobbyItems.map((trip) => trip.organizer)
  ];

  return candidates.find((user) => String(user?.id || "") === id) || null;
}

function getFriendActionLabel(relationship) {
  if (relationship === "friend") {
    return "Friend";
  }

  if (relationship === "outgoing_pending") {
    return "Sent";
  }

  if (relationship === "incoming_pending") {
    return "Pending";
  }

  return "Add";
}

async function handleTripEditSubmit(event) {
  event.preventDefault();
  if (!activeTripId) {
    return;
  }

  const formData = new FormData(tripEditForm);
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("startDate") || "").trim();
  const endDate = String(formData.get("endDate") || "").trim();
  const visibility = formData.get("isPrivate") === "on" ? "private" : "public";
  const submitButton = tripEditForm.querySelector("button[type='submit']");

  if (!name) {
    setFormError(tripEditError, "Destination is required.");
    return;
  }

  const dateError = validateTripDates(tripEditForm);
  if (dateError) {
    setFormError(tripEditError, dateError);
    return;
  }

  setFormError(tripEditError, "");
  submitButton.disabled = true;
  submitButton.textContent = "Saving...";

  try {
    await updateTrip(activeTripId, {
      name,
      destination: name,
      startDate: startDate || null,
      endDate: endDate || null,
      visibility
    });
    await loadTrips();
  } catch (error) {
    setFormError(tripEditError, error.message || "Unable to update trip.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save";
  }
}

async function openCreateTripInviteDialog() {
  setFormError(createTripInviteError, "");
  createTripInviteDialog.hidden = false;
  createTripInviteList.innerHTML = `<p class="empty">Loading friends...</p>`;

  try {
    await loadFriends();
    createInviteFriends = friendsState.friends || [];
    const availableFriendIds = new Set(createInviteFriends.map((friend) => String(friend.id)));
    selectedCreateInviteFriendIds = new Set(
      Array.from(selectedCreateInviteFriendIds).filter((friendId) =>
        availableFriendIds.has(friendId)
      )
    );
    renderCreateTripInviteDialog();
  } catch (error) {
    setFormError(createTripInviteError, error.message || "Unable to load friends.");
    createTripInviteList.innerHTML = "";
  }
}

function closeCreateTripInviteDialog() {
  createTripInviteDialog.hidden = true;
  createInviteFriends = [];
  setFormError(createTripInviteError, "");
  createTripInviteList.innerHTML = "";
  updateCreateTripInviteButton();
}

function renderCreateTripInviteDialog() {
  updateCreateTripInviteButton();

  if (!createInviteFriends.length) {
    createTripInviteList.innerHTML = `<p class="empty">No friends to invite.</p>`;
    return;
  }

  createTripInviteList.innerHTML = createInviteFriends
    .map((friend) => {
      const isSelected = selectedCreateInviteFriendIds.has(String(friend.id));
      return `
        <button
          type="button"
          class="invite-friend-row${isSelected ? " is-selected" : ""}"
          data-create-invite-friend-id="${escapeHtml(friend.id)}"
          aria-pressed="${isSelected ? "true" : "false"}"
        >
          ${renderAvatarMarkup(friend)}
          <span class="invite-friend-copy">
            <strong>${escapeHtml(getDisplayName(friend))}</strong>
            <span>@${escapeHtml(getUserId(friend))}</span>
          </span>
          <span class="invite-check" aria-hidden="true"></span>
        </button>
      `;
    })
    .join("");

  createTripInviteList.querySelectorAll("[data-create-invite-friend-id]").forEach((node) => {
    node.addEventListener("click", () => toggleCreateTripInviteFriend(
      node.dataset.createInviteFriendId
    ));
  });
}

function toggleCreateTripInviteFriend(friendId) {
  const normalizedFriendId = String(friendId || "");

  if (selectedCreateInviteFriendIds.has(normalizedFriendId)) {
    selectedCreateInviteFriendIds.delete(normalizedFriendId);
  } else {
    selectedCreateInviteFriendIds.add(normalizedFriendId);
  }

  renderCreateTripInviteDialog();
}

function clearCreateTripInvites() {
  selectedCreateInviteFriendIds = new Set();
  updateCreateTripInviteButton();
}

function updateCreateTripInviteButton() {
  const count = selectedCreateInviteFriendIds.size;
  createTripInviteCount.textContent = String(count);
  createTripInviteCount.hidden = count === 0;
  createTripInviteButton.classList.toggle("has-selection", count > 0);
}

async function openTripInviteDialog() {
  if (!activeTripId) {
    return;
  }

  setFormError(tripInviteError, "");
  selectedInviteFriendIds = new Set();
  tripInviteDialog.hidden = false;
  tripInviteList.innerHTML = `<p class="empty">Loading friends...</p>`;
  tripInviteSend.disabled = true;

  try {
    await loadFriends();
    const trip = activeTripDetail || (await fetchTrip(activeTripId)).trip;
    inviteableFriends = getInviteableFriends(trip);
    renderTripInviteDialog();
  } catch (error) {
    setFormError(tripInviteError, error.message || "Unable to load friends.");
    tripInviteList.innerHTML = "";
  }
}

function closeTripInviteDialog() {
  tripInviteDialog.hidden = true;
  inviteableFriends = [];
  selectedInviteFriendIds = new Set();
  setFormError(tripInviteError, "");
  tripInviteList.innerHTML = "";
  tripInviteSend.disabled = false;
  tripInviteSend.textContent = "Send";
}

function openTripRemoveParticipantDialog() {
  if (!activeTripDetail) {
    return;
  }

  setFormError(tripRemoveParticipantError, "");
  selectedRemoveParticipantIds = new Set();
  removableParticipants = getRemovableParticipants(activeTripDetail);
  tripRemoveParticipantDialog.hidden = false;
  renderTripRemoveParticipantDialog();
}

function closeTripRemoveParticipantDialog() {
  tripRemoveParticipantDialog.hidden = true;
  removableParticipants = [];
  selectedRemoveParticipantIds = new Set();
  setFormError(tripRemoveParticipantError, "");
  tripRemoveParticipantList.innerHTML = "";
  tripRemoveParticipantSend.disabled = false;
  tripRemoveParticipantSend.textContent = "Remove";
}

function renderTripInviteDialog() {
  updateTripInviteSendState();

  if (!inviteableFriends.length) {
    tripInviteList.innerHTML = `<p class="empty">No friends to invite.</p>`;
    return;
  }

  tripInviteList.innerHTML = inviteableFriends
    .map((friend) => {
      const isSelected = selectedInviteFriendIds.has(String(friend.id));
      return `
        <button
          type="button"
          class="invite-friend-row${isSelected ? " is-selected" : ""}"
          data-invite-friend-id="${escapeHtml(friend.id)}"
          aria-pressed="${isSelected ? "true" : "false"}"
        >
          ${renderAvatarMarkup(friend)}
          <span class="invite-friend-copy">
            <strong>${escapeHtml(getDisplayName(friend))}</strong>
            <span>@${escapeHtml(getUserId(friend))}</span>
          </span>
          <span class="invite-check" aria-hidden="true"></span>
        </button>
      `;
    })
    .join("");

  tripInviteList.querySelectorAll("[data-invite-friend-id]").forEach((node) => {
    node.addEventListener("click", () => toggleInviteFriend(node.dataset.inviteFriendId));
  });
}

function renderTripRemoveParticipantDialog() {
  updateTripRemoveParticipantSendState();

  if (!removableParticipants.length) {
    tripRemoveParticipantList.innerHTML = `<p class="empty">No removable participants.</p>`;
    return;
  }

  tripRemoveParticipantList.innerHTML = removableParticipants
    .map((participant) => {
      const isSelected = selectedRemoveParticipantIds.has(String(participant.id));
      const status = getParticipantStatusLabel(participant);
      return `
        <button
          type="button"
          class="invite-friend-row${isSelected ? " is-selected" : ""}"
          data-remove-participant-id="${escapeHtml(participant.id)}"
          aria-pressed="${isSelected ? "true" : "false"}"
        >
          ${renderAvatarMarkup(participant)}
          <span class="invite-friend-copy">
            <strong>${escapeHtml(getDisplayName(participant))}</strong>
            <span>@${escapeHtml(getUserId(participant))} · ${status}</span>
          </span>
          <span class="invite-check" aria-hidden="true"></span>
        </button>
      `;
    })
    .join("");

  tripRemoveParticipantList.querySelectorAll("[data-remove-participant-id]").forEach((node) => {
    node.addEventListener("click", () =>
      toggleRemoveParticipant(node.dataset.removeParticipantId)
    );
  });
}

function toggleInviteFriend(friendId) {
  const normalizedFriendId = String(friendId || "");

  if (selectedInviteFriendIds.has(normalizedFriendId)) {
    selectedInviteFriendIds.delete(normalizedFriendId);
  } else {
    selectedInviteFriendIds.add(normalizedFriendId);
  }

  renderTripInviteDialog();
}

function toggleRemoveParticipant(participantId) {
  const normalizedParticipantId = String(participantId || "");

  if (selectedRemoveParticipantIds.has(normalizedParticipantId)) {
    selectedRemoveParticipantIds.delete(normalizedParticipantId);
  } else {
    selectedRemoveParticipantIds.add(normalizedParticipantId);
  }

  renderTripRemoveParticipantDialog();
}

function updateTripInviteSendState() {
  tripInviteSend.disabled = selectedInviteFriendIds.size === 0;
}

function updateTripRemoveParticipantSendState() {
  tripRemoveParticipantSend.disabled = selectedRemoveParticipantIds.size === 0;
}

async function sendTripInvites() {
  if (!activeTripId || selectedInviteFriendIds.size === 0) {
    return;
  }

  setFormError(tripInviteError, "");
  tripInviteSend.disabled = true;
  tripInviteSend.textContent = "Sending...";

  try {
    for (const friendId of selectedInviteFriendIds) {
      await inviteParticipant(activeTripId, friendId);
    }
    closeTripInviteDialog();
    await loadTrips();
  } catch (error) {
    setFormError(tripInviteError, error.message || "Unable to send invites.");
    tripInviteSend.disabled = false;
    tripInviteSend.textContent = "Send";
  }
}

async function removeSelectedParticipants() {
  if (!activeTripId || selectedRemoveParticipantIds.size === 0) {
    return;
  }

  setFormError(tripRemoveParticipantError, "");
  tripRemoveParticipantSend.disabled = true;
  tripRemoveParticipantSend.textContent = "Removing...";

  try {
    for (const participantId of selectedRemoveParticipantIds) {
      await removeTripParticipant(activeTripId, participantId);
    }
    closeTripRemoveParticipantDialog();
    await loadTrips();
  } catch (error) {
    setFormError(
      tripRemoveParticipantError,
      error.message || "Unable to remove selected participants."
    );
    tripRemoveParticipantSend.disabled = false;
    tripRemoveParticipantSend.textContent = "Remove";
  }
}

function getInviteableFriends(trip) {
  const participantIds = new Set(
    (trip?.participants || [])
      .filter((participant) => ["approved", "pending"].includes(participant.joinStatus))
      .map((participant) => String(participant.id))
  );

  return (friendsState.friends || []).filter(
    (friend) => !participantIds.has(String(friend.id))
  );
}

function getRemovableParticipants(trip) {
  return (trip?.participants || []).filter(
    (participant) =>
      participant.role !== "organizer" &&
      ["approved", "pending"].includes(participant.joinStatus)
  );
}

function updateTripInviteButton(trip) {
  const count = getInviteableFriends(trip).length;

  tripInviteButton.textContent = count ? "Invite" : "Invite";
  tripInviteButton.setAttribute(
    "aria-label",
    count ? `Invite friends, ${count} available` : "Invite friends"
  );
}

function resetTripInviteButton() {
  tripInviteButton.textContent = "Invite";
  tripInviteButton.removeAttribute("aria-label");
  tripRemoveParticipantButton.disabled = true;
}

function populateTripEditPanel(trip, isOrganizer) {
  tripEditForm.hidden = !isOrganizer;
  tripInviteForm.hidden = !isOrganizer;

  if (!isOrganizer) {
    resetTripInviteButton();
    return;
  }

  tripEditForm.elements.name.value = trip.name || trip.destination || "";
  tripEditForm.elements.startDate.value = trip.startDate || "";
  tripEditForm.elements.endDate.value = trip.endDate || "";
  tripEditForm.elements.isPrivate.checked = trip.visibility !== "public";
  updateTripInviteButton(trip);
  tripRemoveParticipantButton.disabled = getRemovableParticipants(trip).length === 0;
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
  storeUiState();
  document.querySelectorAll(".trip-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.tripId === tripId);
  });
  await refreshDetail();
  detailSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeDetail() {
  activeTripId = null;
  activeTripDetail = null;
  detailSection.hidden = true;
  storeUiState();
  closeDeleteTripDialog();
  closeTripInviteDialog();
  closeTripRemoveParticipantDialog();
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
    storeUiState();
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

function handleModalEscape(event) {
  if (event.key !== "Escape" || event.repeat || event.isComposing) {
    return;
  }

  const closeModal = getTopOpenModalCloseAction();
  if (!closeModal) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  closeModal();
}

function getTopOpenModalCloseAction() {
  const modalStack = [
    [avatarViewDialog, closeAvatarViewDialog],
    [deleteFriendDialog, closeDeleteFriendDialog],
    [deleteTripDialog, closeDeleteTripDialog],
    [joinTripDialog, closeJoinTripDialog],
    [tripRemoveParticipantDialog, closeTripRemoveParticipantDialog],
    [tripInviteDialog, closeTripInviteDialog],
    [createTripInviteDialog, closeCreateTripInviteDialog],
    [friendProfileDialog, closeFriendProfileDialog],
    [friendRequestsDialog, closeFriendRequestsDialog],
    [addFriendDialog, closeAddFriendDialog],
    [profileDialog, closeProfileDialog]
  ];

  return modalStack.find(([dialog]) => dialog && !dialog.hidden)?.[1] || null;
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
  const approvedParticipants = (trip.participants || []).filter(
    (participant) => participant.joinStatus === "approved"
  );
  const pendingParticipants = (trip.participants || []).filter(
    (participant) => participant.joinStatus === "pending"
  );
  activeTripDetail = trip;

  detailTitle.textContent = trip.name;
  detailMeta.textContent = formatTripMeta(trip, approvedParticipants.length);
  detailParticipants.innerHTML = approvedParticipants
    .map(renderTripParticipantChip)
    .join("");
  detailPendingInvitationsWrap.hidden = pendingParticipants.length === 0;
  detailPendingInvitations.innerHTML = pendingParticipants
    .map(renderTripParticipantChip)
    .join("");

  const isOrganizer = trip.organizerId === currentUser?.id;
  detailDelete.hidden = !isOrganizer;
  detailDelete.dataset.tripId = String(trip.id);
  populateTripEditPanel(trip, isOrganizer);
  setFormError(tripEditError, "");
  renderBudget(budgetPanel, { trip, isOrganizer, onChange: loadTrips });
  renderExpenses(expensesPanel, { trip, currentUserId: currentUser?.id, onChange: loadTrips });
  renderBalances(balancesPanel, { balances, trip, currentUserId: currentUser?.id });
}

function formatTripMeta(trip, participantCount) {
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const visibility = trip.visibility === "public" ? "Public" : "Private";
  return `${dates} · ${pluralize(participantCount, "participant")} · ${visibility}`;
}

function formatTripDates(startDate, endDate) {
  if (startDate && endDate) return `${startDate} → ${endDate}`;
  return startDate || endDate || "Dates TBD";
}

function renderTripParticipantChip(participant) {
  const status = getParticipantStatusLabel(participant);
  const stateClass = participant.joinStatus === "pending"
    ? "is-pending"
    : participant.role === "organizer"
      ? "is-organizer"
      : "is-member";

  return `
    <span class="chip ${stateClass}" title="${escapeHtml(getDisplayName(participant))} · ${status}">
      <span class="chip-name">${escapeHtml(getDisplayName(participant))}</span>
      <span class="chip-status">${status}</span>
    </span>
  `;
}

function getParticipantStatusLabel(participant) {
  if (participant.joinStatus === "pending") {
    return "pending";
  }

  if (participant.role === "organizer") {
    return "organizer";
  }

  return "member";
}
