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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const amount = Number(formData.get("amount"));
    const includedParticipantIds = formData.getAll("includedParticipantIds");
    if (!title || !(amount > 0) || !includedParticipantIds.length) {
      error.textContent = "Title, positive amount, and at least one split participant are required.";
      return;
    }
    try {
      await postExpense(trip.id, {
        title,
        amount,
        category: formData.get("category"),
        expenseType: formData.get("expenseType"),
        payerId: formData.get("payerId"),
        splitRule: "equal",
        includedParticipantIds
      });
      form.reset();
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
  const splitCount = expense.includedParticipantIds.length;
  return `
    <div class="expense-row">
      <div>
        <div class="expense-title">${escapeHtml(expense.title)}</div>
        <div class="expense-sub">
          ${escapeHtml(expense.category)} · paid by ${escapeHtml(payer?.name || "unknown")} · split ${splitCount}-ways
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
    .map((p) => `<option value="${p.id}" ${p.id === currentUserId ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
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
        <input type="checkbox" name="includedParticipantIds" value="${p.id}" checked />
        ${escapeHtml(p.name)}
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
      <label class="field">
        <span>Split between</span>
        <div class="participant-picker">${participantChips}</div>
      </label>
      <p id="expense-error" class="form-error"></p>
      <div class="section-actions">
        <button type="submit">Add Expense</button>
      </div>
    </form>
  `;
}
