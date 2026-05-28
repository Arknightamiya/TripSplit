export function roundCurrency(value) {
  return Number(value.toFixed(2));
}

export function splitCurrencyEvenly(amount, participantIds) {
  const splitCount = participantIds.length || 1;
  const totalCents = Math.round(roundCurrency(Number(amount)) * 100);
  const baseShareCents = Math.floor(totalCents / splitCount);
  const remainderCents = totalCents % splitCount;

  return participantIds.map((participantId, index) => ({
    participantId,
    shareAmount: centsToCurrency(baseShareCents + (index < remainderCents ? 1 : 0))
  }));
}

function centsToCurrency(cents) {
  return roundCurrency(cents / 100);
}
