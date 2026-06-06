# TripSplit Integration Baseline

Updated: 2026-06-06

This document records the current shared baseline for integration, review, and
future maintenance. It is not a historical PR checklist; use the BE demo and
handoff docs only when you need their original branch context.

## Source Of Truth

The most important shared files are:

- `README.md`: reviewer-facing setup, demo, and verification guide
- `docs/api-contract.md`: route-level request and response contract
- `database/schema.sql`: PostgreSQL schema source of truth
- `shared/contracts.js`: shared route builders, constants, and auth keys
- `docs/testing-plan.md`: automated and manual test coverage summary
- `docs/reference-architecture-notes.md`: architecture conventions and review
  reminders

Frontend and backend work should follow these files first. If a feature changes
an API field, response shape, database relationship, shared constant, setup
step, or verification workflow, update the relevant shared document in the same
change.

## Current Architecture

TripSplit is a runnable Express app with a static browser frontend.

- `server/app.js` creates the Express app, API routes, static file serving, and
  error middleware.
- `server/index.js` loads environment configuration, connects the database
  boundary, seeds the in-memory store when appropriate, starts the currency
  refresh scheduler, and starts the HTTP server.
- `server/routes/` owns HTTP route definitions.
- `server/middleware/` owns auth, CORS, and error handling.
- `server/services/` owns business rules for auth, users, friends, trips,
  expenses, balances, currencies, email, seed data, and currency scheduling.
- `server/repositories/` owns PostgreSQL-backed data access when `DATABASE_URL`
  is configured.
- `server/store.js` remains the in-memory fallback data layer for fast local
  development and default automated tests.
- `server/db/pool.js` is the PostgreSQL pool boundary.
- `web/` contains static HTML, CSS, and browser JavaScript modules.
- `shared/contracts.js` contains route builders and shared constants used by the
  frontend and backend.

The app has two data modes:

- Without `DATABASE_URL`, TripSplit uses the in-memory store and seeds local demo
  users/trips at startup.
- With `DATABASE_URL`, TripSplit uses PostgreSQL repositories and expects the
  schema to be applied before use. The local Docker setup script handles schema
  application and seed data for reviewer demos.

## API Contract

`docs/api-contract.md` defines the request and response format for:

- health and currency APIs
- auth and profile APIs
- friend, friend request, trip lobby, trip invitation, and trip join APIs
- trip list/detail/create/update/delete APIs
- trip start/end lifecycle APIs
- participant and invitation management APIs
- budget APIs
- expense create, soft-delete, and restore APIs
- balance APIs

Private app APIs must use:

```http
Authorization: Bearer <token>
```

The backend identifies the current user from the JWT. The frontend should not
send `organizerId` or any other field pretending to identify the logged-in user.

Key shared response shapes:

- `user` includes stable `id`, immutable `userId`/`name`, editable
  `displayName`, `email`, and `avatarUrl`.
- `budgetSummary` includes `mode`, `totalBudget`, `perPersonBudget`,
  `currencyCode`, `participantCount`, `totalSpent`, `remainingBudget`, and
  `overBudgetAmount`.
- `expense` includes `expenseType`, `currencyCode`, `payerId`, `splitRule`,
  `includedParticipantIds`, `expenseShares`, `createdAt`, `deletedAt`, and
  `deletedBy`.
- Trip detail includes approved `participantIds`, all `participants`,
  `budgetSummary`, active `expenses`, `deletedExpenses`, `auditLogs`,
  `startedAt`, and `endedAt`.

If one of these shapes changes, update `docs/api-contract.md`,
`shared/contracts.js`, affected frontend render/API helpers, and tests together.

## PostgreSQL Schema

`database/schema.sql` defines the PostgreSQL data model used by the repository
path.

Key integrity rules:

- Expense payer must be an approved participant in the trip.
- Every expense share participant must be an approved participant in the trip.
- Expense share records must belong to the same trip as the expense.
- Budget mode must match its required fields:
  - `total` uses `total_budget`
  - `per-person` uses `per_person_budget`
- Expense category, expense type, and split rule values are constrained to the
  shared MVP values.
- Friendships are removed in both directions.
- Pending trip invitations do not count toward approved participant totals until
  accepted.

Expense type meanings:

- `budget_payment`: organizer-only expense paid from the shared trip budget. It
  increases `budgetSummary.totalSpent` and selected participants' `budgetSpent`,
  but it does not create personal reimbursement balances.
- `personal_advance`: participant-paid out-of-pocket expense split across
  selected participants. It affects personal reimbursement fields `actualPaid`,
  `fairShare`, and `netBalance`, but not `budgetSummary.totalSpent`.

Trip lifecycle rules:

- Expenses cannot be recorded before a trip starts.
- After a trip starts, trip metadata, participant changes, and trip deletion are
  locked.
- After a trip starts, budgets can only be increased using the same budget mode.
- After a trip ends, budget changes, expense creation, expense deletion, and
  expense restore are locked.

## Shared Constants

`shared/contracts.js` includes shared constants for:

- API base path
- route builders for auth, profile, friends, trips, lifecycle, participants,
  invitations, currencies, budgets, expenses, restore, and balances
- expense categories
- budget modes
- expense types
- split rules
- auth header name
- auth token storage key

Frontend and backend code should import or mirror these constants instead of
inventing new strings.

## Testing Baseline

Default tests run with:

```bash
npm test
```

The default suite covers the in-memory API path, auth/session behavior, profile
updates, friends/social flows, trip lifecycle rules, budgets, expenses, balances,
settlement helpers, currency display helpers, and the currency refresh scheduler.

The PostgreSQL path is covered by the opt-in smoke test:

```bash
npm run test:db
```

Use a disposable database with `database/schema.sql` applied. The local macOS
Docker database workflow in the README can prepare that environment.

## Reference Architecture Lessons

`docs/reference-architecture-notes.md` records architecture patterns reviewed
from the prior BruinDating project. The useful rules still apply:

- keep a clear frontend/backend boundary
- centralize frontend API calls in `web/api.js`
- keep backend domain logic separated by routes, services, repositories, and
  testable utility modules
- treat `docs/api-contract.md` as the response-shape boundary
- keep shared style and UI conventions coordinated through `web/styles.css`
- keep environment variable expectations explicit in README and `.env.example`

TripSplit's current stack is static browser JavaScript, Express, PostgreSQL with
an in-memory fallback, JWT auth, and Node's built-in test runner.

## Integration Guidance

- Update shared docs whenever shared behavior changes.
- Keep `README.md` sufficient for reviewer setup and workflow verification.
- Keep `docs/api-contract.md` synchronized with actual route handlers.
- Keep `database/schema.sql` synchronized with repository behavior.
- Keep `shared/contracts.js` synchronized with frontend API usage.
- Add or update tests for new permissions, lifecycle rules, schema behavior,
  currency behavior, and settlement logic.
- Avoid unrelated refactors in shared files during feature work.
- Keep `main` runnable and demo-ready after every merge.
