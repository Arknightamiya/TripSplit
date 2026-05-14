# TripSplit Integration Baseline

Updated: 2026-05-14

This document records the shared baseline that all team branches should use before starting feature implementation.

## Source Of Truth

The most important shared files are:

- `docs/api-contract.md`
- `database/schema.sql`
- `shared/contracts.js`
- `docs/reference-architecture-notes.md`

Frontend and backend work should follow these files first. If a feature branch needs to change an API field, response shape, database relationship, or shared constant, update these shared files first or coordinate with the integrator before implementation.

## What Was Standardized

### Backend Framework

The backend starter has been migrated from a single Node HTTP router to an Express structure:

- `server/app.js` creates the Express app.
- `server/index.js` starts the app and loads environment configuration.
- `server/routes/` owns HTTP route definitions.
- `server/middleware/` owns auth, CORS, and error handling.
- `server/services/` owns auth, trip, expense, balance, and seed logic.
- `server/db/pool.js` is the PostgreSQL pool boundary.
- `server/store.js` remains the temporary in-memory data layer until BE branches replace it with PostgreSQL-backed implementations.

Private trip APIs now require bearer JWTs in the starter backend, matching `docs/api-contract.md`.

### API Contract

`docs/api-contract.md` now defines the agreed request and response format for:

- Auth APIs
- Trip APIs
- Participant APIs
- Budget APIs
- Expense APIs
- Balance APIs

Private trip APIs must use:

```http
Authorization: Bearer <token>
```

The frontend should not send `organizerId` when creating a trip. The backend must identify the current user from the token and set the organizer from that authenticated user.

Budget responses should use the shared `budgetSummary` shape:

```json
{
  "mode": "per-person",
  "totalBudget": 900,
  "perPersonBudget": 300,
  "participantCount": 3,
  "totalSpent": 540,
  "remainingBudget": 360,
  "overBudgetAmount": 0
}
```

Expense requests and responses should use the standardized fields:

- `expenseType`
- `splitRule`
- `includedParticipantIds`
- `expenseShares`

Do not introduce another field name such as `type` for expense type or `amount` for budget amount unless the API contract is updated first.

### PostgreSQL Schema

`database/schema.sql` now defines the target data relationships for future PostgreSQL work.

Key integrity rules:

- Expense payer must be a participant in the trip.
- Every expense share participant must be a participant in the trip.
- Expense share records must belong to the same trip as the expense.
- Budget mode must match its required fields:
  - `total` uses `total_budget`
  - `per-person` uses `per_person_budget`
- Expense category, expense type, and split rule values are constrained to the shared MVP values.

These rules are important because settlement and access control both depend on trip membership being correct.

### Shared Constants

`shared/contracts.js` now includes shared constants for:

- API base path
- route builders
- expense categories
- budget modes
- expense types
- split rules
- auth header name
- auth token storage key

Frontend and backend code should import or mirror these constants instead of inventing new strings.

### Reference Architecture Lessons

`docs/reference-architecture-notes.md` records the useful architecture patterns reviewed from the prior BruinDating project.

The main borrowed ideas are:

- central frontend API client
- central auth state and protected route pattern
- backend domain separation
- explicit response-shape boundary
- shared theme discipline
- environment variable discipline

The team should not copy BruinDating's stack or dating-app features. TripSplit's target stack remains React, Express, PostgreSQL, and JWT.

## Branch Baseline

The following branches were aligned to the same baseline commit after this integration update:

- `main`
- `frontend/fe1-auth-trip-dashboard`
- `frontend/fe2-budget-expense-balance-ui`
- `backend/be1-auth-trip-budget-api`
- `backend/be2-expense-settlement-api`
- `shared/integration-testing`

Each team member can now start from their assigned branch without creating a new branch.

## Implementation Guidance

- FE 1 should build auth pages, trip list/dashboard, create trip, and invite participant UI against `docs/api-contract.md`.
- FE 2 should build budget, expense entry/ledger, and balance summary UI against the shared `budgetSummary`, `expense`, and `balances` response shapes.
- BE 1 should implement auth/JWT/access control and trip/participant/budget APIs according to the contract.
- BE 2 should implement expense APIs, expense shares, settlement recalculation, balance APIs, and delete expense behavior according to the contract and schema.
- The integrator should review changes to shared files, schema, API helpers, tests, and styling before merge.
- Pull or merge work should update shared contract, schema, constants, theme, and integration notes whenever those shared assumptions change.

## Validation Completed

After the baseline update:

- `npm test` passed.
- Express API workflow tests passed.
- JavaScript syntax checks passed.
- whitespace checks passed.
- local PDFs in `file/` and local `.DS_Store` files were not committed.
