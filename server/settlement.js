import { splitCurrencyEvenly } from "./utils/currency.js";

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

export function calculateBalances(trip) {
  const balances = new Map();

  for (const participantId of trip.participantIds) {
    balances.set(participantId, {
      participantId,
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    });
  }

  for (const expense of trip.expenses) {
    const payer = balances.get(expense.payerId);
    if (payer) {
      payer.actualPaid = roundCurrency(payer.actualPaid + expense.amount);
    }

    const expenseShares = expense.expenseShares?.length
      ? expense.expenseShares
      : createEqualShares(expense);

    for (const share of expenseShares) {
      const entry = balances.get(share.participantId);
      if (!entry) {
        continue;
      }

      entry.fairShare = roundCurrency(entry.fairShare + share.shareAmount);
    }
  }

  return Array.from(balances.values()).map((entry) => ({
    ...entry,
    netBalance: roundCurrency(entry.actualPaid - entry.fairShare)
  }));
}

function createEqualShares(expense) {
  const includedParticipantIds = expense.includedParticipantIds || [];
  return splitCurrencyEvenly(expense.amount, includedParticipantIds);
}
