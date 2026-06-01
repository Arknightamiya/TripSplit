# BE2 Handoff: Expense, Settlement, And Balance Work

This document is for the BE2 developer. It explains what BE2 can assume from BE1, which branch to start from, and which API/schema contracts must stay consistent.

## Current Branch To Use

BE2 should base new work on the current BE1 development branch:

```bash
origin/backend/be1-trip-access-persistence
```

This branch includes:

- PR1 scope: BE1 slices 1-3
- PR2 scope: BE1 slices 4-5

That means it includes auth/JWT, PostgreSQL user support, trip creation, trip participants, and trip access-control helpers.

## Does PR2 Need To Be Merged First?

No. BE2 does not need to wait for PR2 to be merged into `main` before starting development.

However, BE2 should not start from old `main`, because old `main` does not contain the latest BE1 trip persistence and access-control helper work.

Recommended workflow:

```text
BE2 starts from origin/backend/be1-trip-access-persistence
BE1 opens PR2 later
BE1 PR2 gets reviewed and merged
BE2 then rebases or merges latest main before opening the BE2 PR
```

## Setup Commands

If starting fresh:

```bash
git fetch origin
git switch -c backend/be2-expense-settlement-api origin/backend/be1-trip-access-persistence
npm install
npm test
```

If local BE2 work already exists, do not overwrite it. Merge or rebase it with:

```bash
origin/backend/be1-trip-access-persistence
```

before continuing.

## BE1 Behavior BE2 Can Assume

BE2 can assume the following BE1 behavior exists:

1. `req.user.id` is the current authenticated user from the JWT.
2. All private APIs use:

```http
Authorization: Bearer <token>
```

3. `ensureApprovedParticipant(userId, tripId)` checks whether a user is an approved trip participant.
4. `ensureOrganizer(userId, tripId)` checks whether a user is an approved organizer.
5. Trip and participant data follows `database/schema.sql`.
6. The frontend should not send `organizerId`; the backend derives organizer identity from the JWT.

## BE2 Ownership

BE2 should focus on:

- `server/routes/expenses.js`
- `server/routes/balances.js`
- `server/services/expenses.js`
- `server/settlement.js`
- PostgreSQL persistence for `expenses`
- PostgreSQL persistence for `expense_shares`
- balance recalculation after create/delete expense
- tests for expenses, expense shares, balances, and delete/recalculation

## Required Contracts

Follow `docs/api-contract.md` exactly.

Important endpoints:

```text
POST /api/trips/:tripId/expenses
DELETE /api/trips/:tripId/expenses/:expenseId
GET /api/trips/:tripId/balances
```

Do not rename shared request/response fields:

```text
expenseType
includedParticipantIds
expenseShares
shareAmount
budgetSummary
balances
budgetSpent
actualPaid
fairShare
netBalance
```

## Expense Creation Rules

For `POST /api/trips/:tripId/expenses`:

- `expenseType` must be `budget_payment` or `personal_advance`.
- `budget_payment` means the organizer paid from the shared trip budget. Only the organizer can create it.
- `personal_advance` means one participant paid out of pocket for selected trip participants. Any approved participant can record it.
- The payer must be an approved participant in the trip.
- Every included split participant must be an approved participant in the trip.
- MVP `splitRule` is `equal`.
- For equal split, create one `expenseShare` per included participant.
- Round each share to 2 decimal places.
- After creating the expense, return the created expense, updated `budgetSummary`, and updated `balances`.
- `budgetSummary.totalSpent` should count only `budget_payment` expenses, not `personal_advance` expenses.

## Delete Expense Rules

For `DELETE /api/trips/:tripId/expenses/:expenseId`:

- The requester must be either the expense payer or the trip organizer.
- The expense must belong to the requested trip.
- Deleting an expense must delete related `expense_shares`.
- After deletion, recalculate and return updated `budgetSummary` and `balances`.

## Balance Rules

Balances are calculated from expenses and expense shares.

Response fields:

```text
actualPaid
fairShare
netBalance
budgetSpent
```

Meaning:

- `budgetSpent`: how much shared trip budget was used for that participant.
- Positive `netBalance`: the participant paid more than their fair share.
- Negative `netBalance`: the participant paid less than their fair share.
- `netBalance = actualPaid - fairShare`.
Only `personal_advance` affects `actualPaid`, `fairShare`, and `netBalance`; `budget_payment` affects `budgetSpent` and `budgetSummary.totalSpent`.

## Database Tables BE2 Should Use

Use `database/schema.sql` as the source of truth.

Main BE2 tables:

```text
expenses
expense_shares
```

Related BE1 tables BE2 depends on:

```text
users
trips
trip_participants
budgets
split_rules
```

Important schema rules:

- `expenses.trip_id` references `trips.id`.
- `expenses.payer_id` must belong to `trip_participants`.
- `expense_shares.participant_id` must belong to `trip_participants`.
- `expense_shares` should be deleted when the parent expense is deleted.

## Testing Expectations

BE2 should add or update tests for:

- creating a `budget_payment` expense
- creating a `personal_advance` expense
- creating equal `expenseShares`
- rejecting payer who is not a trip participant
- rejecting split participants who are not trip participants
- calculating balances after expense creation
- deleting an expense
- recalculating balances after deletion
- enforcing payer-or-organizer delete permission

Before opening the BE2 PR, run:

```bash
npm test
```

Expected result should be all tests passing.

## Coordination Notes

BE2 should coordinate with BE1 before changing:

- auth middleware behavior
- `req.user` shape
- trip participant roles/statuses
- API field names in `docs/api-contract.md`
- database schema in `database/schema.sql`

If any of those need to change, update the shared contract first so FE1, FE2, BE1, and BE2 stay aligned.
