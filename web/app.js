import {
  clearAuthSession,
  deleteTrip,
  fetchBalances,
  fetchHealth,
  fetchTrip,
  fetchTrips,
  getStoredCurrentUser,
  login,
  register,
  storeAuthSession
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
const currentUserEmail = document.querySelector("#current-user-email");
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
const budgetPanel = document.querySelector("#budget-panel");
const expensesPanel = document.querySelector("#expenses-panel");
const balancesPanel = document.querySelector("#balances-panel");

let activeTripId = null;
const SAVED_LOGIN_STORAGE_KEY = "tripsplit.savedLogin";

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => showAuthMode(tab.dataset.authMode));
});
loginForm.addEventListener("submit", handleLogin);
registerForm.addEventListener("submit", handleRegister);
differentAccountButton.addEventListener("click", clearSavedLogin);
logoutButton.addEventListener("click", handleLogout);
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
  currentUserName.textContent = user.name;
  currentUserEmail.textContent = user.email;
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
      return `<span class="${cls}">${escapeHtml(p.name)}</span>`;
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
