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

    const splitCount = expense.includedParticipantIds.length || 1;
    const fairShare = expense.amount / splitCount;

    for (const participantId of expense.includedParticipantIds) {
      const entry = balances.get(participantId);
      if (!entry) {
        continue;
      }

      entry.fairShare = roundCurrency(entry.fairShare + fairShare);
    }
  }

  return Array.from(balances.values()).map((entry) => ({
    ...entry,
    netBalance: roundCurrency(entry.actualPaid - entry.fairShare)
  }));
}
