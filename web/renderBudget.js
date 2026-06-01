import { postBudget } from "./api.js";
import { escapeHtml, formatMoney } from "./renderTrips.js";

export function renderBudget(panel, { trip, isOrganizer, onChange }) {
  const summary = trip.budgetSummary;
  const tripStarted = Boolean(trip.startedAt);
  const tripEnded = Boolean(trip.endedAt);
  const participantCount = getApprovedParticipantCount(trip, summary);
  panel.classList.toggle("is-locked", tripEnded);
  panel.innerHTML = `
    <div class="panel-header">
      <h2>Budget</h2>
      <span class="hint">${summary ? labelForMode(summary.mode) : "No budget yet"}</span>
    </div>
    ${summary ? statsHtml(summary) : ""}
    ${isOrganizer ? budgetFormHtml(summary, tripStarted, tripEnded) : ""}
  `;

  if (!isOrganizer) return;

  const toggle = panel.querySelector("#budget-toggle");
  const form = panel.querySelector("#budget-form");
  if (!form) return;

  const error = panel.querySelector("#budget-error");
  const modeControl = form.elements.mode;
  const modeSelect = form.querySelector('select[name="mode"]');
  const amountInput = form.querySelector('input[name="amount"]');
  const amountLabel = form.querySelector('[data-amount-label]');

  toggle?.addEventListener("click", () => {
    form.hidden = false;
    toggle.hidden = true;
    amountInput.focus();
  });

  function syncLabel() {
    if (!amountLabel || !modeControl) return;
    const mode = modeControl.value;
    const isAdd = form.dataset.budgetAction === "add";
    if (isAdd) {
      amountLabel.textContent = mode === "total"
        ? "Additional total budget ($)"
        : "Additional per-person budget ($)";
      return;
    }

    amountLabel.textContent = mode === "total" ? "Total budget ($)" : "Per-person budget ($)";
  }
  modeSelect?.addEventListener("change", syncLabel);
  amountInput.addEventListener("keydown", preventInvalidNumberKey);
  amountInput.addEventListener("input", sanitizeNumberInput);
  syncLabel();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const mode = modeControl?.value || summary?.mode || "total";
    const amount = Number(amountInput.value);
    if (!(amount > 0)) {
      error.textContent = "Enter a positive amount.";
      return;
    }
    const payload = buildBudgetPayload(form.dataset.budgetAction, summary, mode, amount, participantCount);
    try {
      await postBudget(trip.id, payload);
      await onChange();
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

function buildBudgetPayload(action, summary, mode, amount, participantCount = 1) {
  if (action === "add" && summary) {
    if (mode === "total") {
      return {
        mode: "total",
        totalBudget: roundCurrency(Number(summary.totalBudget || 0) + amount)
      };
    }

    const currentPerPerson = Number(summary.perPersonBudget)
      || roundCurrency(Number(summary.totalBudget || 0) / Math.max(participantCount, 1));
    return {
      mode: "per-person",
      perPersonBudget: roundCurrency(currentPerPerson + amount)
    };
  }

  return mode === "total"
    ? { mode, totalBudget: amount }
    : { mode, perPersonBudget: amount };
}

function statsHtml(s) {
  const overClass = s.overBudgetAmount > 0 ? " is-over" : "";
  return `
    <div class="budget-grid">
      <div class="budget-stat">
        <span class="budget-stat-label">Total Budget</span>
        <span class="budget-stat-value">${formatMoney(s.totalBudget)}</span>
      </div>
      ${s.perPersonBudget != null ? `
        <div class="budget-stat">
          <span class="budget-stat-label">Per Person</span>
          <span class="budget-stat-value">${formatMoney(s.perPersonBudget)}</span>
        </div>` : ""}
      <div class="budget-stat">
        <span class="budget-stat-label">Spent</span>
        <span class="budget-stat-value">${formatMoney(s.totalSpent)}</span>
      </div>
      <div class="budget-stat">
        <span class="budget-stat-label">Remaining</span>
        <span class="budget-stat-value">${formatMoney(s.remainingBudget)}</span>
      </div>
      <div class="budget-stat${overClass}">
        <span class="budget-stat-label">Over Budget</span>
        <span class="budget-stat-value">${formatMoney(s.overBudgetAmount)}</span>
      </div>
    </div>
  `;
}

function budgetFormHtml(summary, tripStarted, tripEnded) {
  if (tripEnded) {
    return "";
  }

  if (summary && tripStarted) {
    return `
      <div class="section-actions budget-actions">
        <button type="button" id="budget-toggle">Add Budget</button>
      </div>
      <form id="budget-form" class="form-grid budget-form" data-budget-action="add" hidden>
        <p class="hint">Trip has started. You can only add more budget.</p>
        <input type="hidden" name="mode" value="${escapeHtml(summary.mode)}" />
        <div class="budget-entry-row budget-add-row">
          <label class="field">
            <span data-amount-label>${summary.mode === "total" ? "Additional total budget ($)" : "Additional per-person budget ($)"}</span>
            <input type="number" name="amount" min="0" step="0.01" required />
          </label>
          <div class="section-actions">
            <button type="submit">Add Budget</button>
          </div>
        </div>
        <p id="budget-error" class="form-error"></p>
      </form>
    `;
  }

  const mode = summary?.mode || "total";
  const amountValue = summary
    ? (mode === "total" ? summary.totalBudget : summary.perPersonBudget) ?? ""
    : "";
  const formHidden = summary ? "hidden" : "";
  const action = summary ? "update" : "set";
  return `
    ${summary ? `
      <div class="section-actions budget-actions">
        <button type="button" id="budget-toggle">Modify Budget</button>
      </div>` : ""}
    <form id="budget-form" class="form-grid budget-form" data-budget-action="${action}" ${formHidden}>
      <div class="budget-entry-row">
        <label class="field budget-type-field">
          <span>Type</span>
          <select name="mode">
            <option value="total" ${mode === "total" ? "selected" : ""}>Total</option>
            <option value="per-person" ${mode === "per-person" ? "selected" : ""}>Per Person</option>
          </select>
        </label>
        <label class="field">
          <span data-amount-label>Total budget ($)</span>
          <input type="number" name="amount" min="0" step="0.01" value="${escapeHtml(amountValue)}" required />
        </label>
        <div class="section-actions">
          <button type="submit">${summary ? "Update Budget" : "Set Budget"}</button>
        </div>
      </div>
      <p id="budget-error" class="form-error"></p>
    </form>
  `;
}

function getApprovedParticipantCount(trip, summary) {
  const fromSummary = Number(summary?.participantCount);
  if (fromSummary > 0) return fromSummary;

  const fromParticipants = (trip.participants || []).filter(
    (participant) => participant.joinStatus === "approved"
  ).length;
  return Math.max(fromParticipants, 1);
}

function labelForMode(mode) {
  return mode === "per-person" ? "per-person mode" : "total mode";
}

function preventInvalidNumberKey(event) {
  if (["e", "E", "+", "-"].includes(event.key)) {
    event.preventDefault();
  }
}

function sanitizeNumberInput(event) {
  event.target.value = event.target.value.replace(/[eE+-]/g, "");
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}
