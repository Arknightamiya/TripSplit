import { escapeHtml, formatMoney } from "./renderTrips.js";
import {
  DEFAULT_CURRENCY_CODE,
  convertMoney,
  currencyOptionsHtml,
  normalizeCurrencyCode,
  normalizeCurrencyInfo
} from "./currency.js";

let selectedBalanceCurrencyCode = DEFAULT_CURRENCY_CODE;

export function renderBalances(panel, { balances, trip, currentUserId, currencyInfo }) {
  const normalizedCurrencyInfo = normalizeCurrencyInfo(currencyInfo);
  selectedBalanceCurrencyCode = normalizeCurrencyCode(selectedBalanceCurrencyCode);
  const displayBalances = convertBalancesForDisplay(
    balances,
    trip,
    selectedBalanceCurrencyCode,
    normalizedCurrencyInfo
  );

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Balances</h2>
      <label class="compact-select">
        <span>Currency</span>
        <select data-balance-currency>
          ${currencyOptionsHtml(normalizedCurrencyInfo, { selectedCode: selectedBalanceCurrencyCode })}
        </select>
      </label>
    </div>
    ${displayBalances.length ? tableHtml(displayBalances, trip, currentUserId, selectedBalanceCurrencyCode, normalizedCurrencyInfo) : `<p class="empty">No balances yet — add expenses to see who owes what.</p>`}
  `;

  const select = panel.querySelector("[data-balance-currency]");
  select?.addEventListener("change", () => {
    selectedBalanceCurrencyCode = select.value;
    renderBalances(panel, { balances, trip, currentUserId, currencyInfo: normalizedCurrencyInfo });
  });
}

function tableHtml(balances, trip, currentUserId, currencyCode, currencyInfo) {
  const participantById = new Map(trip.participants.map((p) => [p.id, p]));
  const rows = balances
    .map((b) => {
      const participant = b.participant || participantById.get(b.participantId);
      const name = participant?.displayName || participant?.name || b.participantId;
      const youTag = b.participantId === currentUserId ? ' <span class="chip">you</span>' : "";
      const netClass = b.netBalance > 0 ? "positive" : b.netBalance < 0 ? "negative" : "";
      const prefix = b.netBalance > 0 ? "+" : b.netBalance < 0 ? "-" : "";
      const netDisplay = `${prefix}${formatMoney(Math.abs(b.netBalance), currencyCode, currencyInfo)}`;
      return `
        <tr>
          <td>${escapeHtml(name)}${youTag}</td>
          <td>${formatMoney(b.actualPaid, currencyCode, currencyInfo)}</td>
          <td>${formatMoney(b.fairShare, currencyCode, currencyInfo)}</td>
          <td class="${netClass}">${netDisplay}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="balance-table">
      <thead>
        <tr>
          <th>Participant</th>
          <th>Paid</th>
          <th>Fair share</th>
          <th>Net</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function convertBalancesForDisplay(balances, trip, targetCurrencyCode, currencyInfo) {
  const participantIds = balances.length
    ? balances.map((balance) => balance.participantId)
    : (trip.participantIds || []);
  const byParticipant = new Map(
    participantIds.map((participantId) => [
      participantId,
      {
        participantId,
        actualPaid: 0,
        fairShare: 0,
        netBalance: 0,
        participant: balances.find((balance) => balance.participantId === participantId)?.participant
      }
    ])
  );

  for (const expense of trip.expenses || []) {
    const expenseCurrencyCode = expense.currencyCode || DEFAULT_CURRENCY_CODE;
    const paidAmount = convertMoney(
      expense.amount,
      expenseCurrencyCode,
      targetCurrencyCode,
      currencyInfo
    );
    const payerEntry = byParticipant.get(expense.payerId);
    if (payerEntry && paidAmount !== null) {
      payerEntry.actualPaid = roundMoney(payerEntry.actualPaid + paidAmount);
    }

    for (const share of expense.expenseShares || []) {
      const shareAmount = convertMoney(
        share.shareAmount,
        expenseCurrencyCode,
        targetCurrencyCode,
        currencyInfo
      );
      const shareEntry = byParticipant.get(share.participantId);
      if (shareEntry && shareAmount !== null) {
        shareEntry.fairShare = roundMoney(shareEntry.fairShare + shareAmount);
      }
    }
  }

  return Array.from(byParticipant.values()).map((entry) => ({
    ...entry,
    netBalance: roundMoney(entry.actualPaid - entry.fairShare)
  }));
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}
