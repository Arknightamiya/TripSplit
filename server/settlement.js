import { splitCurrencyEvenly } from "./utils/currency.js";

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

export function calculateBalances(trip) {
  const balances = new Map();

  for (const participantId of trip.participantIds) {
    balances.set(participantId, {
      participantId,
      budgetSpent: 0,
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    });
  }

  for (const expense of trip.expenses) {
    const expenseShares = shouldUseStoredShares(expense)
      ? expense.expenseShares
      : createEqualShares(expense);

    if (expense.expenseType === "budget_payment") {
      for (const share of expenseShares) {
        const entry = balances.get(share.participantId);
        if (!entry) {
          continue;
        }

        entry.budgetSpent = roundCurrency(entry.budgetSpent + share.shareAmount);
      }
      continue;
    }

    const payer = balances.get(expense.payerId);
    const reimbursableTotal = roundCurrency(
      expenseShares.reduce((sum, share) => sum + Number(share.shareAmount), 0)
    );
    const payerOwnShare = roundCurrency(Number(expense.amount) - reimbursableTotal);

    if (payer) {
      payer.actualPaid = roundCurrency(payer.actualPaid + expense.amount);
      payer.fairShare = roundCurrency(payer.fairShare + payerOwnShare);
    }

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
  if (expense.expenseType === "personal_advance") {
    return createPersonalAdvanceShares(expense);
  }

  return splitCurrencyEvenly(expense.amount, getFallbackParticipantIds(expense));
}

function shouldUseStoredShares(expense) {
  const expenseShares = expense.expenseShares || [];

  if (!expenseShares.length) {
    return false;
  }

  const participantIds = expenseShares.map((share) => String(share.participantId));
  if (new Set(participantIds).size !== participantIds.length) {
    return false;
  }

  const shareTotal = roundCurrency(
    expenseShares.reduce((sum, share) => sum + Number(share.shareAmount), 0)
  );

  if (expense.expenseType === "personal_advance") {
    if (participantIds.includes(String(expense.payerId))) {
      return false;
    }

    const expectedTotal = roundCurrency(
      createPersonalAdvanceShares(expense).reduce(
        (sum, share) => sum + Number(share.shareAmount),
        0
      )
    );
    return shareTotal === expectedTotal;
  }

  return shareTotal === roundCurrency(Number(expense.amount));
}

function getFallbackParticipantIds(expense) {
  const includedParticipantIds = uniqueStrings(expense.includedParticipantIds || []);
  return includedParticipantIds.length ? includedParticipantIds : [expense.payerId];
}

function createPersonalAdvanceShares(expense) {
  const payerId = String(expense.payerId);
  const debtorIds = uniqueStrings(expense.includedParticipantIds || [])
    .filter((participantId) => participantId !== payerId);

  if (!debtorIds.length) {
    return [];
  }

  return splitCurrencyEvenly(expense.amount, [payerId, ...debtorIds])
    .filter((share) => String(share.participantId) !== payerId);
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(String)));
}
