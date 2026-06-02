import { postBudget } from "./api.js";
import { escapeHtml, formatMoney } from "./renderTrips.js";
import {
  DEFAULT_CURRENCY_CODE,
  bindCurrencySelectLabels,
  convertMoney,
  currencyOptionsHtml,
  normalizeCurrencyInfo
} from "./currency.js";

export function renderBudget(panel, { trip, isOrganizer, onChange, currencyInfo }) {
  const normalizedCurrencyInfo = normalizeCurrencyInfo(currencyInfo);
  const summary = getDisplayBudgetSummary(trip, normalizedCurrencyInfo);
  const tripStarted = Boolean(trip.startedAt);
  const tripEnded = Boolean(trip.endedAt);
  const participantCount = getApprovedParticipantCount(trip, summary);
  panel.classList.toggle("is-locked", tripEnded);
  panel.innerHTML = `
    <div class="panel-header">
      <h2>Budget</h2>
      <span class="expense-count-badge">${summary ? labelForMode(summary.mode) : "No budget yet"}</span>
    </div>
    ${summary ? statsHtml(summary, normalizedCurrencyInfo) : ""}
    ${isOrganizer ? budgetFormHtml(summary, tripStarted, tripEnded, normalizedCurrencyInfo) : ""}
  `;

  if (!isOrganizer) return;

  const toggle = panel.querySelector("#budget-toggle");
  const form = panel.querySelector("#budget-form");
  if (!form) return;

  const error = panel.querySelector("#budget-error");
  bindCurrencySelectLabels(form);
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
    const currencyCode = form.elements.currencyCode?.value || summary?.currencyCode || DEFAULT_CURRENCY_CODE;
    if (!(amount > 0)) {
      error.textContent = "Enter a positive amount.";
      return;
    }
    const payload = buildBudgetPayload(
      form.dataset.budgetAction,
      summary,
      mode,
      amount,
      participantCount,
      currencyCode
    );
    try {
      await postBudget(trip.id, payload);
      await onChange();
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

function getDisplayBudgetSummary(trip, currencyInfo) {
  const summary = trip.budgetSummary;
  if (!summary) {
    return null;
  }

  const currencyCode = summary.currencyCode || DEFAULT_CURRENCY_CODE;
  const budgetPayments = Array.isArray(trip.expenses)
    ? trip.expenses.filter((expense) => expense.expenseType === "budget_payment")
    : [];

  if (!budgetPayments.length) {
    return summary;
  }

  const totalSpent = roundCurrency(budgetPayments.reduce((sum, expense) => {
    const convertedAmount = convertMoney(
      expense.amount,
      expense.currencyCode || DEFAULT_CURRENCY_CODE,
      currencyCode,
      currencyInfo
    );
    return sum + (convertedAmount ?? 0);
  }, 0));
  const totalBudget = Number(summary.totalBudget || 0);

  return {
    ...summary,
    totalSpent,
    remainingBudget: roundCurrency(Math.max(totalBudget - totalSpent, 0)),
    overBudgetAmount: roundCurrency(Math.max(totalSpent - totalBudget, 0))
  };
}

function buildBudgetPayload(action, summary, mode, amount, participantCount = 1, currencyCode = DEFAULT_CURRENCY_CODE) {
  if (action === "add" && summary) {
    if (mode === "total") {
      return {
        mode: "total",
        currencyCode,
        totalBudget: roundCurrency(Number(summary.totalBudget || 0) + amount)
      };
    }

    const currentPerPerson = Number(summary.perPersonBudget)
      || roundCurrency(Number(summary.totalBudget || 0) / Math.max(participantCount, 1));
    return {
      mode: "per-person",
      currencyCode,
      perPersonBudget: roundCurrency(currentPerPerson + amount)
    };
  }

  return mode === "total"
    ? { mode, currencyCode, totalBudget: amount }
    : { mode, currencyCode, perPersonBudget: amount };
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

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function budgetFormHtml(summary, tripStarted, tripEnded, currencyInfo) {
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
        <input type="hidden" name="currencyCode" value="${escapeHtml(summary.currencyCode || DEFAULT_CURRENCY_CODE)}" />
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
  const currencyOptions = currencyOptionsHtml(currencyInfo, {
    selectedCode: summary?.currencyCode || DEFAULT_CURRENCY_CODE
  });
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
        <label class="field">
          <span>Currency</span>
          <select name="currencyCode" data-currency-select>${currencyOptions}</select>
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
