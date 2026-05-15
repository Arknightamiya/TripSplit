import {
  ensureDemoAuth,
  fetchBalances,
  fetchHealth,
  fetchTrip,
  fetchTrips,
  getStoredCurrentUser
} from "./api.js";
import { setupTripForm } from "./forms.js";
import { renderBalances } from "./renderBalances.js";
import { renderBudget } from "./renderBudget.js";
import { renderExpenses } from "./renderExpenses.js";
import { escapeHtml, pluralize, renderTrips } from "./renderTrips.js";

const statusText = document.querySelector("#status-text");
const tripList = document.querySelector("#trip-list");
const tripForm = document.querySelector("#trip-form");
const detailSection = document.querySelector("#trip-detail");
const detailTitle = document.querySelector("#detail-title");
const detailEyebrow = document.querySelector("#detail-eyebrow");
const detailMeta = document.querySelector("#detail-meta");
const detailParticipants = document.querySelector("#detail-participants");
const detailClose = document.querySelector("#detail-close");
const budgetPanel = document.querySelector("#budget-panel");
const expensesPanel = document.querySelector("#expenses-panel");
const balancesPanel = document.querySelector("#balances-panel");

let activeTripId = null;

setupTripForm(tripForm, loadTrips);
detailClose.addEventListener("click", closeDetail);

bootstrap();

async function bootstrap() {
  await loadStatus();
  await ensureDemoAuth();
  await loadTrips();
}

async function loadStatus() {
  const data = await fetchHealth();
  statusText.textContent = data.ok ? `${data.service} is running.` : "The API is offline.";
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
  document.querySelectorAll(".trip-card.is-active").forEach((c) => c.classList.remove("is-active"));
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
