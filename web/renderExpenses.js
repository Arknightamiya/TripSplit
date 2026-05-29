import {
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES
} from "/shared/contracts.js";
import { deleteExpense, postExpense } from "./api.js";
import { escapeHtml, formatMoney } from "./renderTrips.js";

export function renderExpenses(panel, { trip, currentUserId, onChange }) {
  const approved = trip.participants.filter((p) => p.joinStatus === "approved");
  const isOrganizer = trip.organizerId === currentUserId;

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Expenses</h2>
      <span class="hint">${trip.expenses.length} recorded</span>
    </div>
    ${expenseFormHtml(approved, currentUserId)}
    <div class="expense-list">${
      trip.expenses.length
        ? trip.expenses.map((e) => expenseRowHtml(e, approved, currentUserId, isOrganizer)).join("")
        : `<p class="empty">No expenses yet.</p>`
    }</div>
  `;

  const form = panel.querySelector("#expense-form");
  const error = panel.querySelector("#expense-error");
  const payerSelect = form.elements.payerId;
  const typeSelect = form.elements.expenseType;
  const splitField = form.querySelector("[data-split-field]");
  const splitPicker = form.querySelector("[data-split-picker]");
  const personalAdvanceNote = form.querySelector("[data-personal-advance-note]");
  const splitCheckboxes = Array.from(form.querySelectorAll("input[name='includedParticipantIds']"));

  function syncSplitControls() {
    const isPersonalAdvance = typeSelect.value === "personal_advance";

    splitPicker.hidden = isPersonalAdvance;
    personalAdvanceNote.hidden = !isPersonalAdvance;
    splitField.classList.toggle("is-disabled", isPersonalAdvance);
    splitCheckboxes.forEach((checkbox) => {
      checkbox.disabled = isPersonalAdvance;
      if (isPersonalAdvance) {
        checkbox.checked = false;
      }
    });
  }

  typeSelect.addEventListener("change", syncSplitControls);
  payerSelect.addEventListener("change", syncSplitControls);
  syncSplitControls();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const amount = Number(formData.get("amount"));
    const expenseType = formData.get("expenseType");
    const payerId = formData.get("payerId");
    const includedParticipantIds = expenseType === "personal_advance"
      ? [payerId]
      : formData.getAll("includedParticipantIds");
    if (!title || !(amount > 0) || (expenseType === "shared" && !includedParticipantIds.length)) {
      error.textContent = "Title, positive amount, and at least one split participant are required.";
      return;
    }
    try {
      await postExpense(trip.id, {
        title,
        amount,
        category: formData.get("category"),
        expenseType,
        payerId,
        splitRule: "equal",
        includedParticipantIds
      });
      form.reset();
      syncSplitControls();
      await onChange();
    } catch (err) {
      error.textContent = err.message;
    }
  });

  panel.querySelectorAll("[data-delete-expense]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await deleteExpense(trip.id, btn.dataset.deleteExpense);
        await onChange();
      } catch (err) {
        error.textContent = err.message;
        btn.disabled = false;
      }
    });
  });
}

function expenseRowHtml(expense, approved, currentUserId, isOrganizer) {
  const payer = approved.find((p) => p.id === expense.payerId);
  const canDelete = isOrganizer || expense.payerId === currentUserId;
  const expenseSummary = expense.expenseType === "personal_advance"
    ? `${escapeHtml(expense.category)} · paid by ${escapeHtml(displayName(payer))} · personal advance`
    : `${escapeHtml(expense.category)} · paid by ${escapeHtml(displayName(payer))} · split between ${escapeHtml(splitParticipantNames(expense, approved))}`;
  return `
    <div class="expense-row">
      <div>
        <div class="expense-title">${escapeHtml(expense.title)}</div>
        <div class="expense-sub">
          ${expenseSummary}
        </div>
      </div>
      <div class="expense-amount">${formatMoney(expense.amount)}</div>
      ${canDelete
        ? `<button type="button" class="button-danger" data-delete-expense="${expense.id}">Delete</button>`
        : `<span></span>`}
    </div>
  `;
}

function expenseFormHtml(approved, currentUserId) {
  const payerOptions = approved
    .map((p) => `<option value="${p.id}" ${p.id === currentUserId ? "selected" : ""}>${escapeHtml(displayName(p))}</option>`)
    .join("");
  const categoryOptions = EXPENSE_CATEGORIES
    .map((c) => `<option value="${c}">${escapeHtml(c)}</option>`)
    .join("");
  const typeOptions = EXPENSE_TYPES
    .map((t) => `<option value="${t}">${escapeHtml(t.replace("_", " "))}</option>`)
    .join("");
  const participantChips = approved
    .map((p) => `
      <label>
        <input type="checkbox" name="includedParticipantIds" value="${p.id}" />
        ${escapeHtml(displayName(p))}
      </label>
    `)
    .join("");

  return `
    <form id="expense-form" class="form-grid">
      <div class="form-grid-row">
        <label class="field">
          <span>Title</span>
          <input type="text" name="title" placeholder="Dinner" required />
        </label>
        <label class="field">
          <span>Amount ($)</span>
          <input type="number" name="amount" min="0" step="0.01" required />
        </label>
      </div>
      <div class="form-grid-row">
        <label class="field">
          <span>Category</span>
          <select name="category">${categoryOptions}</select>
        </label>
        <label class="field">
          <span>Type</span>
          <select name="expenseType">${typeOptions}</select>
        </label>
        <label class="field">
          <span>Payer</span>
          <select name="payerId">${payerOptions}</select>
        </label>
      </div>
      <label class="field" data-split-field>
        <span>Split between</span>
        <div class="participant-picker" data-split-picker>${participantChips}</div>
        <span class="hint" data-personal-advance-note hidden>Personal advance is paid only by the payer.</span>
      </label>
      <p id="expense-error" class="form-error"></p>
      <div class="section-actions">
        <button type="submit">Add Expense</button>
      </div>
    </form>
  `;
}

function splitParticipantNames(expense, approved) {
  return expense.includedParticipantIds
    .map((participantId) => displayName(approved.find((p) => p.id === participantId)))
    .join(", ") || "unknown";
}

function displayName(user) {
  return user?.displayName || user?.name || "unknown";
}
