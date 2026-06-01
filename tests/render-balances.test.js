import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSettlementTransfers, getParticipantTransferDetails } from "../web/renderBalances.js";

test("buildSettlementTransfers settles only personal reimbursement balances", () => {
  const transfers = buildSettlementTransfers([
    { id: "dw1", name: "dw#1", budgetLeft: 600, personalNet: -3.25 },
    { id: "a", name: "dw#2", budgetLeft: 600, personalNet: -1.58 },
    { id: "b", name: "gogo#1", budgetLeft: 600, personalNet: 1.75 },
    { id: "e", name: "E", budgetLeft: 600, personalNet: 1.42 },
    { id: "f", name: "F", budgetLeft: 600, personalNet: 1.66 }
  ]);

  assert.deepEqual(transfers, [
    { fromId: "dw1", from: "dw#1", toId: "b", to: "gogo#1", amount: 1.75 },
    { fromId: "dw1", from: "dw#1", toId: "e", to: "E", amount: 1.42 },
    { fromId: "dw1", from: "dw#1", toId: "f", to: "F", amount: 0.08 },
    { fromId: "a", from: "dw#2", toId: "f", to: "F", amount: 1.58 }
  ]);
});

test("buildSettlementTransfers returns no transfers when personal balances are settled", () => {
  const transfers = buildSettlementTransfers([
    { id: "dw1", name: "dw#1", budgetLeft: 100, personalNet: 0 },
    { id: "a", name: "dw#2", budgetLeft: -100, personalNet: 0 }
  ]);

  assert.deepEqual(transfers, []);
});

test("getParticipantTransferDetails returns outgoing payment details for payers", () => {
  const transfers = [
    { fromId: "dw1", from: "dw#1", toId: "b", to: "gogo#1", amount: 1.75 },
    { fromId: "dw1", from: "dw#1", toId: "e", to: "E", amount: 1.42 },
    { fromId: "a", from: "dw#2", toId: "f", to: "F", amount: 1.58 }
  ];

  assert.deepEqual(
    getParticipantTransferDetails({ id: "a", name: "dw#2", personalNet: -1.58 }, transfers),
    [{ direction: "pay", name: "F", amount: 1.58 }]
  );
});

test("getParticipantTransferDetails returns incoming collection details for collectors", () => {
  const transfers = [
    { fromId: "dw1", from: "dw#1", toId: "b", to: "gogo#1", amount: 1.75 },
    { fromId: "dw1", from: "dw#1", toId: "e", to: "E", amount: 1.42 },
    { fromId: "a", from: "dw#2", toId: "f", to: "F", amount: 1.58 }
  ];

  assert.deepEqual(
    getParticipantTransferDetails({ id: "b", name: "gogo#1", personalNet: 1.75 }, transfers),
    [{ direction: "collect", name: "dw#1", amount: 1.75 }]
  );
});

test("getParticipantTransferDetails returns no rows for settled participants", () => {
  assert.deepEqual(
    getParticipantTransferDetails({ id: "dw1", name: "dw#1", personalNet: 0 }, []),
    []
  );
});
