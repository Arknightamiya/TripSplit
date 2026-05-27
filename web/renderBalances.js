import { escapeHtml, formatMoney } from "./renderTrips.js";

export function renderBalances(panel, { balances, trip, currentUserId }) {
  panel.innerHTML = `
    <div class="panel-header">
      <h2>Balances</h2>
      <span class="hint">Positive = owed money · Negative = owes</span>
    </div>
    ${balances.length ? tableHtml(balances, trip, currentUserId) : `<p class="empty">No balances yet — add expenses to see who owes what.</p>`}
  `;
}

function tableHtml(balances, trip, currentUserId) {
  const participantById = new Map(trip.participants.map((p) => [p.id, p]));
  const rows = balances
    .map((b) => {
      const participant = b.participant || participantById.get(b.participantId);
      const name = participant?.displayName || participant?.name || b.participantId;
      const youTag = b.participantId === currentUserId ? ' <span class="chip">you</span>' : "";
      const netClass = b.netBalance > 0 ? "positive" : b.netBalance < 0 ? "negative" : "";
      const prefix = b.netBalance > 0 ? "+" : b.netBalance < 0 ? "-" : "";
      const netDisplay = `${prefix}${formatMoney(Math.abs(b.netBalance))}`;
      return `
        <tr>
          <td>${escapeHtml(name)}${youTag}</td>
          <td>${formatMoney(b.actualPaid)}</td>
          <td>${formatMoney(b.fairShare)}</td>
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
