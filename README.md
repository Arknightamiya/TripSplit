# TripSplit

TripSplit is a CS130 web application for planning group trips, tracking shared spending, and calculating fair reimbursements. It is built as a runnable Express app with a static HTML/CSS/JavaScript frontend, JWT authentication, optional PostgreSQL persistence, and automated tests for the core API and settlement workflows.

The app is designed for small travel groups such as friends, roommates, student clubs, or campus organizations. A trip organizer can create a trip, invite participants, set a budget, track expenses during the trip, and review final balances when it is time to settle up.

## Demo Video

[TripSplit YouTube Demo](https://youtu.be/4QMfIBZ-JB8)

## Features

TripSplit currently supports these workflows:

- Account registration, email verification, login, JWT session handling, and profile updates with display names and uploaded avatar data URLs.
- Friends, friend requests, public trip discovery, trip invitations, and join requests for public trips.
- Trip creation, trip metadata updates, public/private visibility, participant management, and trip start/end lifecycle controls.
- Total trip budgets and per-person budgets with remaining and over-budget summaries.
- Two expense types:
  - `budget_payment`: organizer-recorded spending from the shared trip budget.
  - `personal_advance`: participant-recorded out-of-pocket payments that selected trip members should reimburse.
- Balance and settlement views that keep shared-budget usage separate from personal reimbursement balances.
- Currency display, fallback currency rates, mixed-currency budget summaries, and an optional background currency refresh scheduler.

TripSplit does not move money directly. Final payment should happen through external tools such as banking apps, Venmo, Zelle, cash, or card payments.

## Tech Stack

- Runtime: Node.js 20+
- Backend: Express 5
- Frontend: static HTML, CSS, and browser JavaScript modules
- Persistence: in-memory store by default; PostgreSQL repository path through `pg` when `DATABASE_URL` is configured
- Authentication: JWT bearer tokens
- Email: optional Gmail SMTP through `nodemailer`
- Testing: Node's built-in test runner
- Database schema: PostgreSQL DDL in `database/schema.sql`

## Quick start

Requires **Node.js 20+** and npm. From a fresh checkout:

```bash
git clone https://github.com/Arknightamiya/TripSplit.git
cd TripSplit
npm ci
npm start
```

Open **http://localhost:3000**. For the in-memory demo, leave `DATABASE_URL` unset and skip creating `.env`. Sign in with `alex@example.com` / `Demo-password1!` to explore the seeded trip. These are local demo credentials; in-memory changes reset on restart.

For PostgreSQL persistence, email delivery, environment settings, additional demo accounts, and multi-user walkthroughs, see the [setup and demo guide](docs/setup-and-demo.md).

## How splitting works

TripSplit distinguishes shared-budget spending from personal advances:

| Expense type | Who records it | Effect |
| --- | --- | --- |
| Shared-budget payment | Organizer | Reduces the trip budget without creating personal reimbursement obligations |
| Personal advance | Participant | Splits an out-of-pocket payment among selected travelers and updates reimbursement balances |

For example, if Alex pays $120 out of pocket for a meal shared equally with Sam, each person's share is $60: Alex is owed $60 and Sam owes $60.

## Verification

```bash
npm test
```

The default suite covers API workflows, access rules, settlement calculations, currency helpers, session storage, and UI rendering helpers. PostgreSQL testing is opt-in and requires a disposable database:

```bash
npm run test:db
```

See the [testing plan](docs/testing-plan.md) for coverage details and the [setup guide](docs/setup-and-demo.md) for database preparation.

## API Overview

The frontend talks to the backend through `/api/...` REST routes. Private app routes require a bearer token.

Route families:

- `/api/auth`: registration, verification, resend code, and login
- `/api/me`: current user profile read/update
- `/api/friends`: friend requests, friend search, public trip lobby, trip join requests, and trip invitations
- `/api/trips`: trip list, create, detail, update, delete, start/end, participants, invitations, and budgets
- `/api/trips/:tripId/expenses`: create, soft-delete, and restore expenses
- `/api/trips/:tripId/balances`: trip balance summaries
- `/api/currencies`: supported currencies and exchange-rate metadata
- `/api/health`: API health check

The API contract and expected response shapes are documented in [the API contract](docs/api-contract.md).

## Data Model

The main domain entities are:

- User
- FriendRequest and Friendship
- Trip
- TripParticipant
- TripJoinRequest
- Budget
- Expense
- ExpenseShare
- SplitRule
- BalanceSummary
- Currency and CurrencyExchangeRate
- AuditLog

The core personal reimbursement formula is:

```text
net balance = actual paid amount - fair share amount
```

A positive personal net balance means the participant paid more than their fair share and should be reimbursed. A negative personal net balance means the participant owes reimbursement.

Budget spending is tracked separately from personal reimbursement balances so shared-budget usage does not create personal repayment obligations.

## Project Structure

```text
TripSplit/
├── database/
│   ├── schema.sql
│   └── *.sh
├── docs/
│   ├── api-contract.md
│   ├── integration-baseline.md
│   ├── reference-architecture-notes.md
│   └── testing-plan.md
├── scripts/
│   └── db/
├── server/
│   ├── app.js
│   ├── index.js
│   ├── db/
│   ├── middleware/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   ├── settlement.js
│   └── store.js
├── shared/
│   └── contracts.js
├── tests/
│   ├── helpers/
│   ├── api.test.js
│   ├── database-smoke.test.js
│   ├── real-world-scenarios.test.js
│   └── *.test.js
├── web/
│   ├── app.js
│   ├── api.js
│   ├── forms.js
│   ├── renderBalances.js
│   ├── renderBudget.js
│   ├── renderExpenses.js
│   ├── renderTrips.js
│   ├── currency.js
│   ├── index.html
│   └── styles.css
├── package.json
└── start.sh
```

## Architecture Notes

- `server/app.js` wires the Express app, API route families, static frontend serving, and error middleware.
- `server/services/` owns business rules for auth, users, friends, trips, expenses, currencies, and seed data.
- `server/repositories/` contains PostgreSQL-backed implementations used when the database layer is enabled.
- `server/store.js` is the in-memory fallback data layer used by default local tests and development without `DATABASE_URL`.
- `web/` is a browser-module frontend with render modules for trips, budgets, expenses, balances, and currency display.
- `tests/helpers/api.js` provides the shared in-process Express request harness used by API and smoke tests.

## Supporting Docs

These files provide deeper implementation and coordination context:

- [docs/api-contract.md](docs/api-contract.md): route-level request and response contract
- [docs/testing-plan.md](docs/testing-plan.md): automated test coverage and priorities
- [docs/integration-baseline.md](docs/integration-baseline.md): integration expectations across branches
- [docs/reference-architecture-notes.md](docs/reference-architecture-notes.md): architecture guidance and conventions
- [docs/branch-plan.md](docs/branch-plan.md): historical branch planning notes
- [docs/cloud-db-verification.md](docs/cloud-db-verification.md): prior hosted PostgreSQL verification notes
- [database/db_setup_readme.md](database/db_setup_readme.md): local Docker PostgreSQL setup and persistence checks
- [database/schema.sql](database/schema.sql): PostgreSQL schema source of truth

## Team and contributions

Built by **XZWSD** for UCLA CS 130. This repository represents the team's combined work; individual changes are recorded in the commit and pull-request history.

For changes, create a focused branch and include a summary and validation results in the pull request. Keep local credentials and database contents out of commits.
