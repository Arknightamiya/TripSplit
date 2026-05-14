import { ensureDemoAuth, fetchHealth, fetchTrips } from "./api.js";
import { setupTripForm } from "./forms.js";
import { renderTrips } from "./renderTrips.js";

const statusText = document.querySelector("#status-text");
const tripList = document.querySelector("#trip-list");
const tripForm = document.querySelector("#trip-form");

setupTripForm(tripForm, loadTrips);

loadTrips();

async function loadStatus() {

  const data = await fetchHealth();
  statusText.textContent = data.ok
    ? `${data.service} is running.`
    : "The API is offline.";
}

async function loadTrips() {
  await loadStatus();
  await ensureDemoAuth();

  const { trips } = await fetchTrips();
  renderTrips(trips, tripList);
}
