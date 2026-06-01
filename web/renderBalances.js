import { escapeHtml, formatMoney } from "./renderTrips.js";

export function renderBalances(panel, {
  balances,
  trip,
  currentUserId,
  isOrganizer = false,
  onEndTrip
}) {
  const tripStarted = Boolean(trip.startedAt);
  const tripEnded = Boolean(trip.endedAt);
  const rowModels = buildBalanceRows(balances, trip, currentUserId);

  panel.innerHTML = `
    <div class="balance-panel-header">
      <div class="balance-title-row">
        <h2>Balances</h2>
        ${isOrganizer ? `
          <button
            type="button"
            class="balance-end-trip-button"
            data-end-trip
            ${tripStarted && !tripEnded ? "" : "disabled"}
          >${tripEnded ? "Trip Ended" : "End Trip"}</button>
        ` : ""}
      </div>
    </div>
    <p class="form-error" data-balance-error hidden></p>
    ${rowModels.length ? tableHtml(rowModels) : `<p class="empty">No balances yet — add expenses to see who owes what.</p>`}
    ${tripEnded && rowModels.length ? finalBillHtml(rowModels) : ""}
  `;

  const endTripButton = panel.querySelector("[data-end-trip]");
  const error = panel.querySelector("[data-balance-error]");
  endTripButton?.addEventListener("click", async () => {
    endTripButton.disabled = true;
    error.textContent = "";
    error.hidden = true;
    try {
      await onEndTrip?.();
    } catch (err) {
      error.textContent = err.message || "Unable to end this trip.";
      error.hidden = false;
      endTripButton.disabled = false;
    }
  });
}

function buildBalanceRows(balances, trip, currentUserId) {
  const participantById = new Map(trip.participants.map((p) => [p.id, p]));
  const startingBudget = getStartingBudget(trip);

  return balances.map((b) => {
    const participant = b.participant || participantById.get(b.participantId);
    const name = displayName(participant) || displayName(participantById.get(b.participantId)) || "Participant";
    const personalNet = roundCurrency(Number(b.netBalance || 0));
    const budgetUsed = roundCurrency(Number(b.budgetSpent || 0));
    const budgetLeft = startingBudget === null
      ? null
      : roundCurrency(startingBudget - budgetUsed);

    return {
      id: String(b.participantId),
      name,
      isCurrentUser: b.participantId === currentUserId,
      budgetUsed,
      budgetLeft,
      advanced: roundCurrency(Number(b.actualPaid || 0)),
      personalNet
    };
  });
}

function tableHtml(rows) {
  const rowHtml = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.name)}${row.isCurrentUser ? ' <span class="chip">you</span>' : ""}</td>
        <td>${formatMoney(row.budgetUsed)}</td>
        <td>${row.budgetLeft === null ? "-" : signedMoney(row.budgetLeft)}</td>
        <td>${formatMoney(row.advanced)}</td>
        <td class="${personalNetClass(row.personalNet)}">${signedMoney(row.personalNet)}</td>
      </tr>
    `)
    .join("");

  return `
    <div class="balance-table-wrap">
      <table class="balance-table">
        <colgroup>
          <col class="balance-col-member">
          <col class="balance-col-money">
          <col class="balance-col-money">
          <col class="balance-col-money">
          <col class="balance-col-reimbursements">
        </colgroup>
        <thead>
          <tr>
            <th>Member</th>
            <th>Budget Used</th>
            <th>Budget Left</th>
            <th>Advanced Paid</th>
            <th>personal reimbursements</th>
          </tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </div>
  `;
}

function finalBillHtml(rows) {
  const bills = rows.map((row) => {
    const budgetBalance = row.budgetLeft ?? 0;
    const personalNet = row.personalNet;
    const finalNet = roundCurrency(budgetBalance + personalNet);

    return `
      <div class="final-bill-card">
        <div class="final-bill-member">
          <strong>${escapeHtml(row.name)}</strong>
          ${row.isCurrentUser ? '<span class="chip">you</span>' : ""}
        </div>
        <dl class="final-bill-lines">
          <div>
            <dt>Budget</dt>
            <dd>${budgetStatusText(budgetBalance)}</dd>
          </div>
          <div>
            <dt>Advanced Paid</dt>
            <dd>${formatMoney(row.advanced)}</dd>
          </div>
          <div>
            <dt>personal reimbursements</dt>
            <dd class="${personalNetClass(personalNet)}">${personalStatusText(personalNet)}</dd>
          </div>
          <div>
            <dt>Combined</dt>
            <dd class="${finalNetClass(finalNet)}">${combinedStatusText(finalNet)}</dd>
          </div>
        </dl>
      </div>
    `;
  }).join("");

  return `
    <div class="final-bill">
      <div class="balance-title-row final-bill-title-row">
        <h2>Final bill</h2>
      </div>
      <div class="final-bill-grid">${bills}</div>
    </div>
  `;
}

function displayName(participant) {
  return String(participant?.displayName || participant?.name || "").trim();
}

function getStartingBudget(trip) {
  const summary = trip.budgetSummary;
  if (!summary || !summary.participantCount) {
    return null;
  }

  if (summary.mode === "per-person") {
    return Number(summary.perPersonBudget || 0);
  }

  return roundCurrency(Number(summary.totalBudget || 0) / Number(summary.participantCount));
}

function signedMoney(value) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(amount))}`;
}

function budgetStatusText(value) {
  const amount = roundCurrency(value);
  if (amount > 0) {
    return `Budget refund ${formatMoney(amount)}`;
  }

  if (amount < 0) {
    return `Pay budget ${formatMoney(Math.abs(amount))}`;
  }

  return "Budget settled";
}

function personalStatusText(value) {
  const amount = roundCurrency(value);
  if (amount > 0) {
    return `Collect ${formatMoney(amount)}`;
  }

  if (amount < 0) {
    return `Pay others ${formatMoney(Math.abs(amount))}`;
  }

  return "No personal balance";
}

function combinedStatusText(value) {
  const amount = roundCurrency(value);
  if (amount > 0) {
    return `Net receive ${formatMoney(amount)}`;
  }

  if (amount < 0) {
    return `Net pay ${formatMoney(Math.abs(amount))}`;
  }

  return "Fully settled";
}

function personalNetClass(value) {
  const amount = roundCurrency(value);
  if (amount > 0) return "personal-net-positive";
  if (amount < 0) return "personal-net-negative";
  return "";
}

function finalNetClass(value) {
  const amount = roundCurrency(value);
  if (amount > 0) return "final-net-positive";
  if (amount < 0) return "final-net-negative";
  return "";
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
