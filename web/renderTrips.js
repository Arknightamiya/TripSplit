export function renderTrips(trips, tripList, { activeTripId, onSelect } = {}) {
  if (!trips.length) {
    tripList.innerHTML = `<p class="empty">No trips yet. Add one above to get started.</p>`;
    return;
  }

  tripList.innerHTML = trips
    .map((trip) => {
      const dates = formatDates(trip.startDate, trip.endDate);
      const budget = formatBudgetSummary(trip.budgetSummary);
      const visibility = trip.visibility === "public" ? "Public" : "Private";
      const isActive = trip.id === activeTripId ? " is-active" : "";
      const organizer = trip.organizerName || "Organizer";
      return `
        <button type="button" class="trip-card${isActive}" data-trip-id="${trip.id}">
          <div class="trip-card-row">
            <span class="trip-card-title-group">
              <strong>${escapeHtml(trip.name)}</strong>
              <span class="trip-organizer-chip">
                <span>${escapeHtml(organizer)}</span>
                <span class="trip-organizer-role">organizer</span>
              </span>
            </span>
            <span class="trip-visibility ${trip.visibility === "public" ? "is-public" : "is-private"}">${visibility}</span>
          </div>
          <div class="trip-card-row">
            <span class="trip-card-meta">${dates}</span>
          </div>
          <div class="trip-card-meta">${pluralize(trip.participantCount, "participant")} · ${budget}</div>
        </button>
      `;
    })
    .join("");

  if (onSelect) {
    tripList.querySelectorAll("[data-trip-id]").forEach((node) => {
      node.addEventListener("click", () => onSelect(node.dataset.tripId));
    });
  }
}

function formatDates(start, end) {
  if (!start && !end) return "Dates TBD";
  if (start && end) return `${start} → ${end}`;
  return start || end;
}

export function formatMoney(value) {
  const n = Number(value || 0);
  return `$${n.toFixed(2)}`;
}

export function formatBudgetSummary(budgetSummary) {
  if (!budgetSummary) {
    return "0 budget";
  }

  if (budgetSummary.mode === "per-person") {
    return `${formatMoney(budgetSummary.perPersonBudget)} budget per person`;
  }

  return `${formatMoney(budgetSummary.totalBudget)} budget`;
}

export function pluralize(count, singular, plural) {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? singular : (plural || `${singular}s`)}`;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}
