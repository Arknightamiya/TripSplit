# TripSplit Testing Plan

## Current Test Setup

The project currently uses Node's built-in test runner:

```bash
npm test
```

The default test script is defined in `package.json` as:

```bash
node --test
```

Current automated coverage includes:

- settlement unit tests in `tests/settlement.test.js`
- Express API workflow tests in `tests/api.test.js`
- real-world API smoke scenarios in `tests/real-world-scenarios.test.js`
- balance rendering and transfer helper tests in `tests/render-balances.test.js`
- currency display and conversion tests in `tests/currency-display.test.js`
- auth storage scoping tests in `tests/session-storage.test.js`
- currency refresh scheduler tests in `tests/currency-refresh-scheduler.test.js`
- a shared API test harness in `tests/helpers/api.js`

The PostgreSQL repository path is covered by an explicit opt-in smoke test:

```bash
npm run test:db
```

`test:db` loads `.env`, sets `TRIPSPLIT_DATABASE_SMOKE=1`, and runs
`tests/database-smoke.test.js`. Use a disposable test database with
`database/schema.sql` already applied. The default `npm test` run skips this smoke
test so ordinary local tests do not write to a real database by accident.

---

## Priority Tests

### Settlement Logic Tests

- Equal split among all participants
- Partial split among selected participants
- Empty expense list
- Decimal rounding to 2 places
- Delete expense and recalculate balances
- Reject or ignore expenses whose payer is not a trip participant
- Reject or ignore split participants who are not trip participants

---

### Budget Tests

- Total budget summary
- Per-person budget summary
- Remaining budget while under budget
- Over-budget amount after expenses exceed the budget
- Budget recalculation after deleting an expense

---

### API Workflow Tests

- Register user
- Login user
- Create trip
- Add participant
- Set budget
- Add expense
- Get balances
- Delete expense
- Re-check balances after deletion
- Reject missing or invalid auth token on private trip APIs
- Reject access by a user who is not an approved trip participant
- Reject organizer-only actions from regular participants

---

### Real-World Smoke Tests

- Keep one complete invitation and public-trip join flow
- Verify a trip can move from planning to started
- Verify a budget payment affects budget spending but not personal reimbursement balances
- Verify a personal advance produces conserved reimbursement balances
- Verify a participant can record and delete their own trip expense
- Avoid duplicating every validation and permission matrix already covered in API tests

---

### Schema / Data Integrity Tests

- Expense payer must belong to the trip
- Expense share participant must belong to the trip
- Expense share trip must match the expense trip
- Budget mode must match the required budget fields
- Expense category and expense type must be from shared constants

The in-memory API tests cover these rules at the service/API contract level. The
opt-in PostgreSQL smoke test verifies the repository-backed path can perform the
same core workflow against a real database schema.

---

## Manual Demo Workflow

1. Start the app.
2. Open the local app in browser.
3. Create a trip.
4. Add participants.
5. Set a budget.
6. Add expenses.
7. View final balances.
8. Delete an expense.
9. Confirm budget and balances update.
10. Try accessing a trip as a non-participant and confirm the request is rejected.
