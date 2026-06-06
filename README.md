# TripSplit

TripSplit is a CS130 web application for planning group trips, tracking shared spending, and calculating fair reimbursements. It is built as a runnable Express app with a static HTML/CSS/JavaScript frontend, JWT authentication, optional PostgreSQL persistence, and automated tests for the core API and settlement workflows.

The app is designed for small travel groups such as friends, roommates, student clubs, or campus organizations. A trip organizer can create a trip, invite participants, set a budget, track expenses during the trip, and review final balances when it is time to settle up.

## Team

Team Name: XZWSD

## Current Product

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

## Getting Started

Install dependencies:

```bash
npm install
```

Optional environment setup:

```bash
cp .env.example .env
```

Configure `.env` when you want PostgreSQL persistence, email verification delivery, currency refresh scheduling, or a custom port. Do not commit real secrets.

Important environment variables:

- `PORT`: server port, defaults to `3000`
- `DATABASE_URL`: enables the PostgreSQL repository path when present
- `JWT_SECRET`: signing secret for JWTs
- `CORS_ORIGIN`: allowed browser origin, defaults to `http://localhost:3000`
- `EMAIL_PROVIDER`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `EMAIL_FROM`: optional Gmail email delivery settings
- `CURRENCY_REFRESH_ENABLED`, `CURRENCY_REFRESH_ON_START`, `CURRENCY_REFRESH_INTERVAL_HOURS`: optional exchange-rate refresh controls

Run the app:

```bash
npm start
```

or:

```bash
./start.sh
```

Open:

```text
http://localhost:3000
```

When `DATABASE_URL` is not set, TripSplit uses the in-memory store and seeds demo users/trips for local development. Use one of these accounts to log in:

| Email | Password | Role |
| --- | --- | --- |
| `alex@example.com` | `Demo-password1!` | Trip organizer |
| `sam@example.com` | `Demo-password1!` | Trip participant |
| `jordan@example.com` | `Demo-password1!` | Trip participant |

Use `alex@example.com` to review the organizer workflow and the seeded San Diego
Weekend trip. If a reviewer registers a new account without email settings, the
verification code is printed in the terminal running the server.

When `DATABASE_URL` is set, the app uses PostgreSQL repositories and does not seed the in-memory demo data. Apply the schema before using a new database:

```bash
npm run db:schema
```

You can also check database connectivity with:

```bash
npm run db:check
```

## Testing

Run the default test suite:

```bash
npm test
```

The default suite covers settlement logic, core Express API workflows, real-world API smoke scenarios, currency display/conversion helpers, auth storage scoping, balance rendering helpers, and the currency refresh scheduler. The PostgreSQL smoke test is intentionally skipped in this default run so ordinary local tests do not write to a real database by accident.

Run the PostgreSQL-backed smoke test:

```bash
npm run test:db
```

`test:db` loads `.env`, sets `TRIPSPLIT_DATABASE_SMOKE=1`, and runs `tests/database-smoke.test.js`. Use a disposable database with `database/schema.sql` already applied. A successful real DB run should report `pass 1` and `skipped 0`.

Useful database and currency scripts:

```bash
npm run db:schema
npm run db:check
npm run db:currency:refresh
npm run db:currency:convert
```

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

The API contract and expected response shapes are documented in `docs/api-contract.md`.

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

- `docs/api-contract.md`: route-level request and response contract
- `docs/testing-plan.md`: automated test coverage and priorities
- `docs/integration-baseline.md`: integration expectations across branches
- `docs/reference-architecture-notes.md`: architecture guidance and conventions
- `docs/branch-plan.md`: historical branch planning notes
- `docs/cloud-db-verification.md`: prior hosted PostgreSQL verification notes
- `database/schema.sql`: PostgreSQL schema source of truth
