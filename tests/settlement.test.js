import test from "node:test";
import assert from "node:assert/strict";
import { calculateBalances } from "../server/settlement.js";

test("calculateBalances splits shared expenses fairly", () => {
  const result = calculateBalances({
    participantIds: ["u1", "u2", "u3"],
    expenses: [
      {
        amount: 90,
        payerId: "u1",
        includedParticipantIds: ["u1", "u2", "u3"]
      },
      {
        amount: 60,
        payerId: "u2",
        includedParticipantIds: ["u1", "u2"]
      }
    ]
  });

  assert.deepEqual(result, [
    {
      participantId: "u1",
      actualPaid: 90,
      fairShare: 60,
      netBalance: 30
    },
    {
      participantId: "u2",
      actualPaid: 60,
      fairShare: 60,
      netBalance: 0
    },
    {
      participantId: "u3",
      actualPaid: 0,
      fairShare: 30,
      netBalance: -30
    }
  ]);
});

test("calculateBalances keeps equal split balances conserved after cent rounding", () => {
  const result = calculateBalances({
    participantIds: ["u1", "u2", "u3"],
    expenses: [
      {
        amount: 500,
        payerId: "u1",
        includedParticipantIds: ["u1", "u2", "u3"]
      }
    ]
  });

  assert.deepEqual(result, [
    {
      participantId: "u1",
      actualPaid: 500,
      fairShare: 166.67,
      netBalance: 333.33
    },
    {
      participantId: "u2",
      actualPaid: 0,
      fairShare: 166.67,
      netBalance: -166.67
    },
    {
      participantId: "u3",
      actualPaid: 0,
      fairShare: 166.66,
      netBalance: -166.66
    }
  ]);
  assert.equal(
    result.reduce((sum, balance) => sum + balance.netBalance, 0),
    0
  );
});

test("calculateBalances repairs stored shares that do not sum to the expense amount", () => {
  const result = calculateBalances({
    participantIds: ["u1", "u2", "u3"],
    expenses: [
      {
        amount: 500,
        expenseType: "shared",
        payerId: "u1",
        includedParticipantIds: ["u1", "u2", "u3"],
        expenseShares: [
          {
            participantId: "u1",
            shareAmount: 166.67
          },
          {
            participantId: "u2",
            shareAmount: 166.67
          },
          {
            participantId: "u3",
            shareAmount: 166.67
          }
        ]
      }
    ]
  });

  assert.deepEqual(result, [
    {
      participantId: "u1",
      actualPaid: 500,
      fairShare: 166.67,
      netBalance: 333.33
    },
    {
      participantId: "u2",
      actualPaid: 0,
      fairShare: 166.67,
      netBalance: -166.67
    },
    {
      participantId: "u3",
      actualPaid: 0,
      fairShare: 166.66,
      netBalance: -166.66
    }
  ]);
  assert.equal(
    result.reduce((sum, balance) => sum + balance.netBalance, 0),
    0
  );
});

test("calculateBalances treats personal advance as payer-only without stored shares", () => {
  const result = calculateBalances({
    participantIds: ["u1", "u2", "u3"],
    expenses: [
      {
        amount: 30,
        expenseType: "personal_advance",
        payerId: "u1",
        includedParticipantIds: ["u1", "u2", "u3"]
      }
    ]
  });

  assert.deepEqual(result, [
    {
      participantId: "u1",
      actualPaid: 30,
      fairShare: 30,
      netBalance: 0
    },
    {
      participantId: "u2",
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    },
    {
      participantId: "u3",
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    }
  ]);
});

test("calculateBalances repairs personal advance with stored shared rows to payer-only", () => {
  const result = calculateBalances({
    participantIds: ["u1", "u2"],
    expenses: [
      {
        amount: 12,
        expenseType: "personal_advance",
        payerId: "u1",
        includedParticipantIds: ["u1", "u2"],
        expenseShares: [
          {
            participantId: "u1",
            shareAmount: 6
          },
          {
            participantId: "u2",
            shareAmount: 6
          }
        ]
      }
    ]
  });

  assert.deepEqual(result, [
    {
      participantId: "u1",
      actualPaid: 12,
      fairShare: 12,
      netBalance: 0
    },
    {
      participantId: "u2",
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    }
  ]);
});

test("calculateBalances falls back shared expenses with empty splits to payer-only", () => {
  const result = calculateBalances({
    participantIds: ["u1", "u2"],
    expenses: [
      {
        amount: 45,
        expenseType: "shared",
        payerId: "u1",
        includedParticipantIds: []
      }
    ]
  });

  assert.deepEqual(result, [
    {
      participantId: "u1",
      actualPaid: 45,
      fairShare: 45,
      netBalance: 0
    },
    {
      participantId: "u2",
      actualPaid: 0,
      fairShare: 0,
      netBalance: 0
    }
  ]);
  assert.equal(
    result.reduce((sum, balance) => sum + balance.netBalance, 0),
    0
  );
});

test("calculateBalances dedupes fallback split participants", () => {
  const result = calculateBalances({
    participantIds: ["u1", "u2"],
    expenses: [
      {
        amount: 90,
        expenseType: "shared",
        payerId: "u1",
        includedParticipantIds: ["u1", "u1", "u2"]
      }
    ]
  });

  assert.deepEqual(result, [
    {
      participantId: "u1",
      actualPaid: 90,
      fairShare: 45,
      netBalance: 45
    },
    {
      participantId: "u2",
      actualPaid: 0,
      fairShare: 45,
      netBalance: -45
    }
  ]);
});

test("calculateBalances conserves mixed shared and personal advance balances", () => {
  const result = calculateBalances({
    participantIds: ["u1", "u2", "u3"],
    expenses: [
      {
        amount: 90,
        expenseType: "shared",
        payerId: "u1",
        includedParticipantIds: ["u1", "u2", "u3"]
      },
      {
        amount: 12,
        expenseType: "personal_advance",
        payerId: "u3",
        includedParticipantIds: ["u1", "u2", "u3"]
      }
    ]
  });

  assert.deepEqual(result, [
    {
      participantId: "u1",
      actualPaid: 90,
      fairShare: 30,
      netBalance: 60
    },
    {
      participantId: "u2",
      actualPaid: 0,
      fairShare: 30,
      netBalance: -30
    },
    {
      participantId: "u3",
      actualPaid: 12,
      fairShare: 42,
      netBalance: -30
    }
  ]);
  assert.equal(
    result.reduce((sum, balance) => sum + balance.netBalance, 0),
    0
  );
});
