import { postBudget } from "./api.js";
import { escapeHtml, formatMoney } from "./renderTrips.js";
import { DEFAULT_CURRENCY_CODE, normalizeCurrencyInfo } from "./currency.js";

export function renderBudget(panel, { trip, isOrganizer, onChange, currencyInfo }) {
  const normalizedCurrencyInfo = normalizeCurrencyInfo(currencyInfo);
  const summary = trip.budgetSummary;
  panel.innerHTML = `
    <div class="panel-header">
      <h2>Budget</h2>
      <span class="hint">${summary ? labelForMode(summary.mode) : "Not set"}</span>
    </div>
    ${summary ? statsHtml(summary, normalizedCurrencyInfo) : `<p class="empty">No budget yet. ${isOrganizer ? "Set one below." : "Ask the organizer to set one."}</p>`}
    ${isOrganizer ? budgetFormHtml(summary) : ""}
  `;

  if (!isOrganizer) return;

  const form = panel.querySelector("#budget-form");
  const error = panel.querySelector("#budget-error");
  const modeInputs = form.querySelectorAll('input[name="mode"]');
  const amountInput = form.querySelector('input[name="amount"]');
  const amountLabel = form.querySelector('[data-amount-label]');

  function syncLabel() {
    const mode = form.querySelector('input[name="mode"]:checked').value;
    amountLabel.textContent = mode === "total" ? "Total budget ($)" : "Per-person budget ($)";
  }
  modeInputs.forEach((input) => input.addEventListener("change", syncLabel));
  syncLabel();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const mode = form.querySelector('input[name="mode"]:checked').value;
    const amount = Number(amountInput.value);
    if (!(amount > 0)) {
      error.textContent = "Enter a positive amount.";
      return;
    }
    const payload = mode === "total"
      ? { mode, totalBudget: amount }
      : { mode, perPersonBudget: amount };
    try {
      await postBudget(trip.id, payload);
      await onChange();
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

function statsHtml(s, currencyInfo) {
  const overClass = s.overBudgetAmount > 0 ? " is-over" : "";
  const currencyCode = s.currencyCode || DEFAULT_CURRENCY_CODE;
  return `
    <div class="budget-grid">
      <div class="budget-stat">
        <span class="budget-stat-label">Total Budget</span>
        <span class="budget-stat-value">${formatMoney(s.totalBudget, currencyCode, currencyInfo)}</span>
      </div>
      ${s.perPersonBudget != null ? `
        <div class="budget-stat">
          <span class="budget-stat-label">Per Person</span>
          <span class="budget-stat-value">${formatMoney(s.perPersonBudget, currencyCode, currencyInfo)}</span>
        </div>` : ""}
      <div class="budget-stat">
        <span class="budget-stat-label">Spent</span>
        <span class="budget-stat-value">${formatMoney(s.totalSpent, currencyCode, currencyInfo)}</span>
      </div>
      <div class="budget-stat">
        <span class="budget-stat-label">Remaining</span>
        <span class="budget-stat-value">${formatMoney(s.remainingBudget, currencyCode, currencyInfo)}</span>
      </div>
      <div class="budget-stat${overClass}">
        <span class="budget-stat-label">Over Budget</span>
        <span class="budget-stat-value">${formatMoney(s.overBudgetAmount, currencyCode, currencyInfo)}</span>
      </div>
    </div>
  `;
}

function budgetFormHtml(summary) {
  const mode = summary?.mode || "total";
  const checkedTotal = mode === "total" ? "checked" : "";
  const checkedPer = mode === "per-person" ? "checked" : "";
  const amountValue = summary
    ? (mode === "total" ? summary.totalBudget : summary.perPersonBudget) ?? ""
    : "";
  return `
    <form id="budget-form" class="form-grid">
      <div class="radio-row">
        <label><input type="radio" name="mode" value="total" ${checkedTotal} />Total</label>
        <label><input type="radio" name="mode" value="per-person" ${checkedPer} />Per Person</label>
      </div>
      <label class="field">
        <span data-amount-label>Total budget ($)</span>
        <input type="number" name="amount" min="0" step="0.01" value="${escapeHtml(amountValue)}" required />
      </label>
      <p id="budget-error" class="form-error"></p>
      <div class="section-actions">
        <button type="submit">${summary ? "Update Budget" : "Set Budget"}</button>
      </div>
    </form>
  `;
}

function labelForMode(mode) {
  return mode === "per-person" ? "per-person mode" : "total mode";
}
