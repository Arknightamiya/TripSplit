import { API_BASE } from "/shared/contracts.js";

const statusText = document.querySelector("#status-text");
const tripList = document.querySelector("#trip-list");
const tripForm = document.querySelector("#trip-form");

tripForm.addEventListener("submit", handleTripSubmit);

loadTrips();

async function loadStatus() {
  const response = await fetch(`${API_BASE}/health`);
  const data = await response.json();
  statusText.textContent = data.ok
    ? `${data.service} is running.`
    : "The API is offline.";
}

async function loadTrips() {
  await loadStatus();

  const response = await fetch(`${API_BASE}/trips`);
  const { trips } = await response.json();
  renderTrips(trips);
}

function renderTrips(trips) {
  if (!trips.length) {
    tripList.innerHTML = `<p class="empty">No trips yet. Add one to test the scaffold.</p>`;
    return;
  }

  tripList.innerHTML = trips
    .map(
      (trip) => `
        <div class="trip-card">
          <strong>${trip.name}</strong>
          <span>ID: ${trip.id}</span>
        </div>
      `
    )
    .join("");
}

async function handleTripSubmit(event) {
  event.preventDefault();
  const formData = new FormData(tripForm);
  const name = String(formData.get("name") || "").trim();
  if (!name) {
    return;
  }

  await fetch(`${API_BASE}/trips`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name })
  });

  tripForm.reset();
  await loadTrips();
}
