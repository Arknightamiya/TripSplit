import {
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES
} from "../shared/contracts.js";
import { deleteExpense, postExpense, restoreExpense } from "./api.js";
import { escapeHtml, formatMoney } from "./renderTrips.js";
import {
  DEFAULT_CURRENCY_CODE,
  bindCurrencySelectLabels,
  currencyOptionsHtml,
  normalizeCurrencyInfo
} from "./currency.js";

function categoryIcon(category) {
  const icons = {
    lodging: "🏨",
    food: "🍽️",
    transportation: "✈️",
    tickets: "🎟️",
    drinks: "🍹",
    emergency: "🚨",
    other: "📦"
  };
  return icons[category] || "📦";
}

export function renderExpenses(panel, { trip, currentUserId, onChange, currencyInfo }) {
  const normalizedCurrencyInfo = normalizeCurrencyInfo(currencyInfo);
  const approved = trip.participants.filter((p) => p.joinStatus === "approved");
  const isOrganizer = trip.organizerId === currentUserId;
  const tripStarted = Boolean(trip.startedAt);
  const tripEnded = Boolean(trip.endedAt);
  const activeExpenses = trip.expenses || [];
  const deletedExpenses = trip.deletedExpenses || [];
  panel.classList.toggle("is-locked", tripEnded);

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Expenses</h2>
      <span class="hint">${activeExpenses.length} recorded</span>
    </div>
    ${expenseFormHtml(approved, currentUserId, isOrganizer, tripStarted, tripEnded, normalizedCurrencyInfo)}
    ${
      activeExpenses.length
        ? `<div class="expense-list">${activeExpenses
            .map((e) => expenseRowHtml(e, approved, currentUserId, isOrganizer, tripEnded, normalizedCurrencyInfo))
            .join("")}</div>`
        : ""
    }
    ${isOrganizer && tripEnded && deletedExpenses.length ? endedDeletedExpensesHintHtml(deletedExpenses) : ""}
    ${isOrganizer && !tripEnded && deletedExpenses.length ? deletedExpensesHtml(deletedExpenses, approved, normalizedCurrencyInfo) : ""}
  `;

  const form = panel.querySelector("#expense-form");
  const error = panel.querySelector("#expense-error");
  bindCurrencySelectLabels(form);
  const titleInput = form.elements.title;
  const amountInput = form.elements.amount;
  const payerSelect = form.elements.payerId;
  const typeSelect = form.elements.expenseType;
  const splitField = form.querySelector("[data-split-field]");
  const splitLabel = form.querySelector("[data-split-label]");
  const splitPicker = form.querySelector("[data-split-picker]");
  const payerField = form.querySelector("[data-payer-field]");
  const budgetPaymentNote = form.querySelector("[data-budget-payment-note]");
  const personalAdvanceNote = form.querySelector("[data-personal-advance-note]");
  const splitCheckboxes = Array.from(form.querySelectorAll("input[name='includedParticipantIds']"));
  const submitButton = form.querySelector("[data-expense-submit]");

  function syncSplitControls() {
    const isBudgetPayment = typeSelect.value === "budget_payment";
    const isPersonalAdvance = typeSelect.value === "personal_advance";
    const payerId = String(payerSelect.value || "");

    if (isBudgetPayment && currentUserId) {
      payerSelect.value = currentUserId;
    }

    const controlsLocked = tripEnded;
    payerField.hidden = false;
    payerSelect.disabled = controlsLocked || isBudgetPayment;
    splitLabel.textContent = isPersonalAdvance ? "Shared with" : "Split between";
    budgetPaymentNote.hidden = !isBudgetPayment;
    personalAdvanceNote.hidden = !isPersonalAdvance;
    splitPicker.hidden = false;
    splitField.classList.toggle("is-disabled", false);
    splitCheckboxes.forEach((checkbox) => {
      const choice = checkbox.closest("[data-participant-choice]");
      const isPayer = String(checkbox.value) === payerId;
      const shouldHide = isPersonalAdvance && isPayer;

      if (choice) {
        choice.hidden = shouldHide;
      }

      checkbox.disabled = controlsLocked || shouldHide;
      if (!controlsLocked) {
        checkbox.checked = !shouldHide;
      }
    });
    submitButton.disabled = !tripStarted || tripEnded;
  }

  typeSelect.addEventListener("change", syncSplitControls);
  payerSelect.addEventListener("change", syncSplitControls);
  amountInput.addEventListener("keydown", preventInvalidNumberKey);
  amountInput.addEventListener("input", sanitizeNumberInput);
  syncSplitControls();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    if (!tripStarted) {
      error.textContent = "Start the trip before recording expenses.";
      return;
    }
    if (tripEnded) {
      error.textContent = "Trip has ended; expenses are locked.";
      return;
    }
    titleInput.setCustomValidity("");
    amountInput.setCustomValidity("");

    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const amount = Number(formData.get("amount"));
    const expenseType = formData.get("expenseType");
    const payerId = expenseType === "budget_payment"
      ? currentUserId
      : formData.get("payerId");
    const includedParticipantIds = formData.getAll("includedParticipantIds");
    if (!title) {
      error.textContent = "Title is required.";
      titleInput.setCustomValidity(error.textContent);
      titleInput.reportValidity();
      titleInput.setCustomValidity("");
      return;
    }
    if (!(amount > 0)) {
      error.textContent = "Enter a positive amount.";
      amountInput.setCustomValidity(error.textContent);
      amountInput.reportValidity();
      amountInput.setCustomValidity("");
      return;
    }
    if (!includedParticipantIds.length) {
      error.textContent = expenseType === "personal_advance"
        ? "Choose at least one person who should reimburse the payer."
        : "Choose at least one person who used this budget expense.";
      return;
    }
    try {
      const result = await postExpense(trip.id, {
        title,
        amount,
        category: formData.get("category"),
        expenseType,
        currencyCode: formData.get("currencyCode") || DEFAULT_CURRENCY_CODE,
        payerId,
        splitRule: "equal",
        includedParticipantIds
      });
      form.reset();
      syncSplitControls();
      submitButton.disabled = !tripStarted || tripEnded;
      await onChange(result, { type: "expense:create" });
    } catch (err) {
      error.textContent = err.message;
    }
  });

  panel.querySelectorAll("[data-delete-expense]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const result = await deleteExpense(trip.id, btn.dataset.deleteExpense);
        await onChange(result, { type: "expense:delete" });
      } catch (err) {
        error.textContent = err.message;
        btn.disabled = false;
      }
    });
  });

  panel.querySelectorAll("[data-restore-expense]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const result = await restoreExpense(trip.id, btn.dataset.restoreExpense);
        await onChange(result, { type: "expense:restore" });
      } catch (err) {
        error.textContent = err.message;
        btn.disabled = false;
      }
    });
  });
}

function preventInvalidNumberKey(event) {
  if (["e", "E", "+", "-"].includes(event.key)) {
    event.preventDefault();
  }
}

function sanitizeNumberInput(event) {
  event.target.value = event.target.value.replace(/[eE+-]/g, "");
}

function expenseRowHtml(expense, approved, currentUserId, isOrganizer, tripEnded, currencyInfo) {
  const payer = approved.find((p) => p.id === expense.payerId);
  const canDelete = !tripEnded && (isOrganizer || expense.payerId === currentUserId);
  const currencyCode = expense.currencyCode || DEFAULT_CURRENCY_CODE;
  const expenseSummary = expense.expenseType === "budget_payment"
    ? `${escapeHtml(expense.category)} · paid from trip budget · used by ${escapeHtml(splitParticipantNames(expense, approved))}`
    : `${escapeHtml(expense.category)} · advanced by ${escapeHtml(displayName(payer))} · shared with ${escapeHtml(splitParticipantNames(expense, approved))}`;
  return `
    <div class="expense-row">
      <div>
        <div class="expense-title">${categoryIcon(expense.category)} ${escapeHtml(expense.title)}</div>
        <div class="expense-sub">
          ${expenseSummary}
        </div>
      </div>
      <div class="expense-amount">${formatMoney(expense.amount, currencyCode, currencyInfo)}</div>
      ${canDelete
        ? `<button type="button" class="button-danger" data-delete-expense="${expense.id}">Delete</button>`
        : `<span></span>`}
    </div>
  `;
}

function deletedExpensesHtml(expenses, approved, currencyInfo) {
  return `
    <div class="deleted-expense-section">
      <div class="panel-header deleted-expense-header">
        <h3>Deleted expenses</h3>
        <span class="hint">${expenses.length} recoverable</span>
      </div>
      <div class="expense-list deleted-expense-list">
        ${expenses.map((expense) => deletedExpenseRowHtml(expense, approved, currencyInfo)).join("")}
      </div>
    </div>
  `;
}

function endedDeletedExpensesHintHtml(expenses) {
  return `
    <div class="deleted-expense-section deleted-expense-locked-note">
      <div class="panel-header deleted-expense-header">
        <h3>Deleted expenses</h3>
        <span class="hint">${expenses.length} locked</span>
      </div>
      <p class="hint">This trip has ended. Deleted expenses can no longer be restored.</p>
    </div>
  `;
}

function deletedExpenseRowHtml(expense, approved, currencyInfo) {
  const payer = approved.find((p) => p.id === expense.payerId);
  const currencyCode = expense.currencyCode || DEFAULT_CURRENCY_CODE;
  const expenseSummary = expense.expenseType === "budget_payment"
    ? `${escapeHtml(expense.category)} · paid from trip budget · used by ${escapeHtml(splitParticipantNames(expense, approved))}`
    : `${escapeHtml(expense.category)} · advanced by ${escapeHtml(displayName(payer))} · shared with ${escapeHtml(splitParticipantNames(expense, approved))}`;

  return `
    <div class="expense-row deleted-expense-row">
      <div>
        <div class="expense-title">${escapeHtml(expense.title)}</div>
        <div class="expense-sub">${expenseSummary}</div>
      </div>
      <div class="expense-amount">${formatMoney(expense.amount, currencyCode, currencyInfo)}</div>
      <button type="button" data-restore-expense="${expense.id}">Restore</button>
    </div>
  `;
}

function expenseFormHtml(approved, currentUserId, isOrganizer, tripStarted, tripEnded, currencyInfo) {
  const payerOptions = approved
    .map((p) => `<option value="${p.id}" ${p.id === currentUserId ? "selected" : ""}>${escapeHtml(displayName(p))}</option>`)
    .join("");
  const categoryOptions = `<option value="" disabled selected>Select category</option>` + EXPENSE_CATEGORIES
  .map((c) => `<option value="${c}">${escapeHtml(c)}</option>`)
  .join("");

const typeOptions = `<option value="" disabled selected>Select type</option>` + EXPENSE_TYPES
  .map((t) => `<option value="${t}">${escapeHtml(t.replace("_", " "))}</option>`)
  .join("");
  const currencyOptions = currencyOptionsHtml(currencyInfo, {
    selectedCode: DEFAULT_CURRENCY_CODE
  });
  const participantChips = approved
    .map((p) => `
      <label data-participant-choice>
        <input type="checkbox" name="includedParticipantIds" value="${p.id}" ${tripEnded ? "disabled" : ""} checked />
        ${escapeHtml(displayName(p))}
      </label>
    `)
    .join("");

  return `
    <form id="expense-form" class="form-grid" novalidate>
      <div class="expense-entry-row">
        <label class="field">
          <span>Title</span>
          <input type="text" name="title" placeholder="e.g. Dinner" ${tripEnded ? "disabled" : ""} required />
        </label>
        <label class="field">
          <span>Category</span>
          <select name="category" ${tripEnded ? "disabled" : ""}>${categoryOptions}</select>
        </label>
        <label class="field">
          <span>Type</span>
          <select name="expenseType" ${tripEnded ? "disabled" : ""}>${typeOptions}</select>
        </label>
        <label class="field" data-payer-field>
          <span>Payer</span>
          <select name="payerId" ${tripEnded ? "disabled" : ""}>${payerOptions}</select>
        </label>
        <label class="field">
          <span>Amount</span>
          <input type="number" name="amount" min="0" step="0.01" placeholder="e.g. 100" ${tripEnded ? "disabled" : ""} required />
        </label>
        <label class="field">
          <span>Currency</span>
          <select name="currencyCode" data-currency-select ${tripEnded ? "disabled" : ""}>${currencyOptions}</select>
        </label>
      </div>
      <div class="expense-secondary-row">
        <label class="field" data-split-field>
          <span data-split-label>Split between</span>
          <div class="participant-picker" data-split-picker>${participantChips}</div>
        </label>
        <div class="section-actions">
          <button type="submit" class="expense-submit" data-expense-submit ${tripStarted && !tripEnded ? "" : "disabled"}>Add Expense</button>
        </div>
      </div>
      <div class="expense-notes">
        <span class="hint" data-budget-payment-note hidden>Paid from the trip budget. Select who used this budget expense.</span>
        <span class="hint" data-personal-advance-note hidden>Select only the people who should reimburse the payer.</span>
      </div>
      <p id="expense-error" class="form-error"></p>
    </form>
  `;
}

function typeLabel(type) {
  if (type === "budget_payment") {
    return "Trip budget payment";
  }

  if (type === "personal_advance") {
    return "Personal advance";
  }

  return type.replace("_", " ");
}

function splitParticipantNames(expense, approved) {
  return expense.includedParticipantIds
    .map((participantId) => displayName(approved.find((p) => p.id === participantId)))
    .join(", ") || "unknown";
}

function displayName(user) {
  return user?.displayName || user?.name || "unknown";
}
