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