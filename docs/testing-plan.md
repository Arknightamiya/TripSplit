# TripSplit Testing Plan

## Current Test Setup

The project currently uses Node's built-in test runner:

```bash
npm test
```

The test script is defined in `package.json` as:

```bash
node --test
```

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

### Schema / Data Integrity Tests

- Expense payer must belong to the trip
- Expense share participant must belong to the trip
- Expense share trip must match the expense trip
- Budget mode must match the required budget fields
- Expense category and expense type must be from shared constants

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
