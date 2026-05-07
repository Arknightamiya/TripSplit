export function renderTrips(trips, tripList){
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