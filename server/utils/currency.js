export function roundCurrency(value) {
  return Number(value.toFixed(2));
}

export function isValidCurrencyAmount(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return false;
  }

  return Math.round(number * 100) >= 1;
}

export function normalizeCurrencyAmount(value) {
  return roundCurrency(Number(value));
}

export function splitCurrencyEvenly(amount, participantIds) {
  if (!participantIds.length) {
    throw new Error("Cannot split currency without participants");
  }

  const splitCount = participantIds.length;
  const totalCents = Math.round(normalizeCurrencyAmount(amount) * 100);
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
