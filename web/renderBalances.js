import { escapeHtml, formatMoney } from "./renderTrips.js";
import {
  DEFAULT_CURRENCY_CODE,
  convertMoney,
  currencyOptionsHtml,
  normalizeCurrencyCode,
  normalizeCurrencyInfo
} from "./currency.js";

let selectedBalanceCurrencyCode = DEFAULT_CURRENCY_CODE;

export function renderBalances(panel, {
  balances,
  trip,
  currentUserId,
  isOrganizer = false,
  onEndTrip,
  currencyInfo
}) {
  const normalizedCurrencyInfo = normalizeCurrencyInfo(currencyInfo);
  selectedBalanceCurrencyCode = normalizeCurrencyCode(selectedBalanceCurrencyCode);
  const tripStarted = Boolean(trip.startedAt);
  const tripEnded = Boolean(trip.endedAt);
  const rowModels = buildBalanceRows(
    balances,
    trip,
    currentUserId,
    selectedBalanceCurrencyCode,
    normalizedCurrencyInfo
  );

  panel.innerHTML = `
    <div class="balance-panel-header">
      <div class="balance-title-row">
        <h2>Balances</h2>
        <label class="compact-select">
          <span>Currency</span>
          <select data-balance-currency>
            ${currencyOptionsHtml(normalizedCurrencyInfo, { selectedCode: selectedBalanceCurrencyCode })}
          </select>
        </label>
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
    ${rowModels.length ? tableHtml(rowModels, selectedBalanceCurrencyCode, normalizedCurrencyInfo) : `<p class="empty">No balances yet — add expenses to see who owes what.</p>`}
    ${tripEnded && rowModels.length ? finalBillHtml(rowModels, selectedBalanceCurrencyCode, normalizedCurrencyInfo) : ""}
  `;

  const select = panel.querySelector("[data-balance-currency]");
  select?.addEventListener("change", () => {
    selectedBalanceCurrencyCode = select.value;
    renderBalances(panel, {
      balances,
      trip,
      currentUserId,
      isOrganizer,
      onEndTrip,
      currencyInfo: normalizedCurrencyInfo
    });
  });

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

  bindTransferDialog(panel, rowModels, selectedBalanceCurrencyCode, normalizedCurrencyInfo);
}

function buildBalanceRows(balances, trip, currentUserId, targetCurrencyCode, currencyInfo) {
  const participantById = new Map(trip.participants.map((p) => [p.id, p]));
  const startingBudget = getStartingBudget(trip, targetCurrencyCode, currencyInfo);
  const convertedBalances = convertBalancesForDisplay(trip, balances, targetCurrencyCode, currencyInfo);

  return convertedBalances.map((b) => {
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

function tableHtml(rows, currencyCode, currencyInfo) {
  const rowHtml = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.name)}${row.isCurrentUser ? ' <span class="chip">you</span>' : ""}</td>
        <td>${formatMoney(row.budgetUsed, currencyCode, currencyInfo)}</td>
        <td>${row.budgetLeft === null ? "-" : signedMoney(row.budgetLeft, currencyCode, currencyInfo)}</td>
        <td>${formatMoney(row.advanced, currencyCode, currencyInfo)}</td>
        <td class="${personalNetClass(row.personalNet)}">${signedMoney(row.personalNet, currencyCode, currencyInfo)}</td>
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

function finalBillHtml(rows, currencyCode, currencyInfo) {
  const transfers = buildSettlementTransfers(rows);
  const bills = rows.map((row) => {
    const budgetBalance = row.budgetLeft ?? 0;
    const personalNet = row.personalNet;
    const finalNet = roundCurrency(budgetBalance + personalNet);
    const personalContent = personalReimbursementHtml(row, transfers);

    return `
      <div class="final-bill-card">
        <div class="final-bill-member">
          <strong>${escapeHtml(row.name)}</strong>
          ${row.isCurrentUser ? '<span class="chip">you</span>' : ""}
        </div>
        <dl class="final-bill-lines">
          <div>
            <dt>Budget</dt>
            <dd>${budgetStatusText(budgetBalance, currencyCode, currencyInfo)}</dd>
          </div>
          <div>
            <dt>Advanced Paid</dt>
            <dd>${formatMoney(row.advanced, currencyCode, currencyInfo)}</dd>
          </div>
          <div>
            <dt>personal reimbursements</dt>
            <dd class="${personalNetClass(personalNet)}">${personalContent(currencyCode, currencyInfo)}</dd>
          </div>
          <div>
            <dt>Combined</dt>
            <dd class="${finalNetClass(finalNet)}">${combinedStatusText(finalNet, currencyCode, currencyInfo)}</dd>
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
      ${transferDialogHtml()}
    </div>
  `;
}

function personalReimbursementHtml(row, transfers) {
  const personalNet = roundCurrency(row.personalNet);
  if (personalNet === 0) {
    return (currencyCode, currencyInfo) => escapeHtml(personalStatusText(personalNet, currencyCode, currencyInfo));
  }

  const participantTransfers = getParticipantTransferDetails(row, transfers);
  const action = personalNet > 0 ? "collect" : "pay";

  return (currencyCode, currencyInfo) => `
    <button
      type="button"
      class="personal-transfer-trigger ${personalNetClass(personalNet)}"
      data-transfer-participant-id="${escapeHtml(row.id)}"
      data-transfer-action="${action}"
      ${participantTransfers.length ? "" : "disabled"}
    >${escapeHtml(personalStatusText(personalNet, currencyCode, currencyInfo))}</button>
  `;
}

function transferDialogHtml() {
  return `
    <div class="modal-overlay transfer-dialog-overlay" data-transfer-dialog hidden>
      <div class="modal transfer-dialog" role="dialog" aria-modal="true" aria-labelledby="transfer-dialog-title">
        <div class="transfer-dialog-header">
          <h2 id="transfer-dialog-title">Personal transfer</h2>
          <button type="button" class="icon-button transfer-dialog-close" data-transfer-close aria-label="Close transfer details">&times;</button>
        </div>
        <p class="hint" data-transfer-dialog-summary></p>
        <ul class="transfer-detail-list" data-transfer-dialog-list></ul>
      </div>
    </div>
  `;
}

export function buildSettlementTransfers(rows) {
  const debtors = rows
    .filter((row) => roundCurrency(row.personalNet) < 0)
    .map((row) => ({
      id: String(row.id),
      name: row.name,
      amount: roundCurrency(Math.abs(row.personalNet))
    }));
  const creditors = rows
    .filter((row) => roundCurrency(row.personalNet) > 0)
    .map((row) => ({
      id: String(row.id),
      name: row.name,
      amount: roundCurrency(row.personalNet)
    }));
  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundCurrency(Math.min(debtor.amount, creditor.amount));

    if (amount > 0) {
      transfers.push({
        fromId: debtor.id,
        from: debtor.name,
        toId: creditor.id,
        to: creditor.name,
        amount
      });
    }

    debtor.amount = roundCurrency(debtor.amount - amount);
    creditor.amount = roundCurrency(creditor.amount - amount);

    if (debtor.amount === 0) {
      debtorIndex += 1;
    }

    if (creditor.amount === 0) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

export function getParticipantTransferDetails(row, transfers) {
  const participantId = String(row.id);
  const personalNet = roundCurrency(row.personalNet);

  if (personalNet < 0) {
    return transfers
      .filter((transfer) => transfer.fromId === participantId)
      .map((transfer) => ({
        direction: "pay",
        name: transfer.to,
        amount: transfer.amount
      }));
  }

  if (personalNet > 0) {
    return transfers
      .filter((transfer) => transfer.toId === participantId)
      .map((transfer) => ({
        direction: "collect",
        name: transfer.from,
        amount: transfer.amount
      }));
  }

  return [];
}

function bindTransferDialog(panel, rows, currencyCode, currencyInfo) {
  const dialog = panel.querySelector("[data-transfer-dialog]");
  if (!dialog) {
    return;
  }

  const transfers = buildSettlementTransfers(rows);
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const title = dialog.querySelector("#transfer-dialog-title");
  const summary = dialog.querySelector("[data-transfer-dialog-summary]");
  const list = dialog.querySelector("[data-transfer-dialog-list]");

  const closeDialog = () => {
    dialog.hidden = true;
    document.removeEventListener("keydown", handleEscape);
  };

  const handleEscape = (event) => {
    if (event.key !== "Escape" || event.repeat || event.isComposing || dialog.hidden) {
      return;
    }

    event.preventDefault();
    closeDialog();
  };

  const openDialog = (row) => {
    const details = getParticipantTransferDetails(row, transfers);
    const isCollector = roundCurrency(row.personalNet) > 0;
    title.textContent = isCollector ? "Collect from others" : "Pay others";
    summary.textContent = isCollector
      ? `${row.name} should collect these personal reimbursements.`
      : `${row.name} should pay these personal reimbursements.`;
    list.innerHTML = details.length
      ? details.map((detail) => `
        <li class="transfer-detail-row">
          <span>${detail.direction === "collect" ? "Collect from" : "Pay"} ${escapeHtml(detail.name)}</span>
          <strong>${formatMoney(detail.amount, currencyCode, currencyInfo)}</strong>
        </li>
      `).join("")
      : `<li class="transfer-detail-row is-settled">No personal transfers needed.</li>`;
    dialog.hidden = false;
    document.addEventListener("keydown", handleEscape);
  };

  panel.querySelectorAll("[data-transfer-participant-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rowById.get(button.dataset.transferParticipantId);
      if (row) {
        openDialog(row);
      }
    });
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-transfer-close]")) {
      closeDialog();
    }
  });
}

function displayName(participant) {
  return String(participant?.displayName || participant?.name || "").trim();
}

function getStartingBudget(trip, targetCurrencyCode, currencyInfo) {
  const summary = trip.budgetSummary;
  if (!summary || !summary.participantCount) {
    return null;
  }
  const budgetCurrencyCode = summary.currencyCode || DEFAULT_CURRENCY_CODE;

  const amount = summary.mode === "per-person"
    ? Number(summary.perPersonBudget || 0)
    : roundCurrency(Number(summary.totalBudget || 0) / Number(summary.participantCount));

  return convertMoney(amount, budgetCurrencyCode, targetCurrencyCode, currencyInfo) ?? amount;
}

function signedMoney(value, currencyCode, currencyInfo) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(amount), currencyCode, currencyInfo)}`;
}

function budgetStatusText(value, currencyCode, currencyInfo) {
  const amount = roundCurrency(value);
  if (amount > 0) {
    return `Budget refund ${formatMoney(amount, currencyCode, currencyInfo)}`;
  }

  if (amount < 0) {
    return `Pay budget ${formatMoney(Math.abs(amount), currencyCode, currencyInfo)}`;
  }

  return "Budget settled";
}

function personalStatusText(value, currencyCode, currencyInfo) {
  const amount = roundCurrency(value);
  if (amount > 0) {
    return `Collect ${formatMoney(amount, currencyCode, currencyInfo)}`;
  }

  if (amount < 0) {
    return `Pay others ${formatMoney(Math.abs(amount), currencyCode, currencyInfo)}`;
  }

  return "No personal balance";
}

function combinedStatusText(value, currencyCode, currencyInfo) {
  const amount = roundCurrency(value);
  if (amount > 0) {
    return `Net receive ${formatMoney(amount, currencyCode, currencyInfo)}`;
  }

  if (amount < 0) {
    return `Net pay ${formatMoney(Math.abs(amount), currencyCode, currencyInfo)}`;
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

function convertBalancesForDisplay(trip, balances, targetCurrencyCode, currencyInfo) {
  const participantIds = balances.length
    ? balances.map((balance) => String(balance.participantId))
    : (trip.participantIds || []).map(String);
  const participantById = new Map(
    participantIds.map((participantId) => [
      participantId,
      {
        participantId,
        budgetSpent: 0,
        actualPaid: 0,
        fairShare: 0,
        netBalance: 0,
        participant: balances.find((balance) => String(balance.participantId) === participantId)?.participant
      }
    ])
  );

  for (const expense of trip.expenses || []) {
    const expenseCurrencyCode = expense.currencyCode || DEFAULT_CURRENCY_CODE;
    const amount = convertMoney(
      expense.amount,
      expenseCurrencyCode,
      targetCurrencyCode,
      currencyInfo
    );
    if (amount === null) {
      continue;
    }

    const shares = expense.expenseShares || [];
    if (expense.expenseType === "budget_payment") {
      for (const share of shares) {
        const shareAmount = convertMoney(
          share.shareAmount,
          expenseCurrencyCode,
          targetCurrencyCode,
          currencyInfo
        );
        const entry = participantById.get(String(share.participantId));
        if (entry && shareAmount !== null) {
          entry.budgetSpent = roundCurrency(entry.budgetSpent + shareAmount);
        }
      }
      continue;
    }

    const payerEntry = participantById.get(String(expense.payerId));
    const reimbursableTotal = shares.reduce((sum, share) => {
      const shareAmount = convertMoney(
        share.shareAmount,
        expenseCurrencyCode,
        targetCurrencyCode,
        currencyInfo
      );
      return shareAmount === null ? sum : sum + shareAmount;
    }, 0);
    const payerOwnShare = roundCurrency(amount - reimbursableTotal);

    if (payerEntry) {
      payerEntry.actualPaid = roundCurrency(payerEntry.actualPaid + amount);
      payerEntry.fairShare = roundCurrency(payerEntry.fairShare + payerOwnShare);
    }

    for (const share of shares) {
      const shareAmount = convertMoney(
        share.shareAmount,
        expenseCurrencyCode,
        targetCurrencyCode,
        currencyInfo
      );
      const entry = participantById.get(String(share.participantId));
      if (entry && shareAmount !== null) {
        entry.fairShare = roundCurrency(entry.fairShare + shareAmount);
      }
    }
  }

  return Array.from(participantById.values()).map((entry) => ({
    ...entry,
    netBalance: roundCurrency(entry.actualPaid - entry.fairShare)
  }));
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
