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
