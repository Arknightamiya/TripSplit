# TripSplit

TripSplit is a CS130 web application for planning group trips, tracking shared spending, and calculating fair reimbursements. It is built as a runnable Express app with a static HTML/CSS/JavaScript frontend, JWT authentication, optional PostgreSQL persistence, and automated tests for the core API and settlement workflows.

The app is designed for small travel groups such as friends, roommates, student clubs, or campus organizations. A trip organizer can create a trip, invite participants, set a budget, track expenses during the trip, and review final balances when it is time to settle up.

## Team

Team Name: XZWSD

## Demo Video

[TripSplit YouTube Demo](https://youtu.be/4QMfIBZ-JB8)

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

For the fastest local review, you can skip `.env` entirely. If you copy
`.env.example`, remove or comment out `DATABASE_URL` unless you are also
starting PostgreSQL. When `DATABASE_URL` is present, TripSplit expects a real
database connection and does not use the in-memory demo seed.

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

When `DATABASE_URL` is not set, TripSplit uses the in-memory store and seeds demo users, friendships, and trips for local development. Use one of these accounts to log in:

| Email | Password | Role |
| --- | --- | --- |
| `alex@example.com` | `Demo-password1!` | Trip organizer |
| `sam@example.com` | `Demo-password1!` | Trip participant and public trip organizer |
| `jordan@example.com` | `Demo-password1!` | Non-friend social demo account |

Use `alex@example.com` to review the organizer workflow and the seeded San Diego
Weekend trip with Sam as the only other seeded participant. Alex and Sam are
seeded as friends, Sam owns a public Yosemite Weekend trip for Trip Lobby
review, and Jordan starts as a non-friend with no seeded trip access so the Add
friend workflow can still be demonstrated. If a reviewer registers a new account
without email settings, the verification code is printed in the terminal running
the server.

Example terminal output:

```text
[TripSplit] Verification code for someone@example.com: 123456
```

## Reviewer/Verification Guide

### Choose A Data Mode

| Mode | How to configure | Expected result | Best use |
| --- | --- | --- | --- |
| In-memory mode | Do not set `DATABASE_URL`. Skip `.env`, or remove/comment the `DATABASE_URL` line after copying `.env.example`. | The server logs `Database layer: noop`. Demo users, an Alex/Sam friendship, Alex/Sam San Diego Weekend, and Sam's public Yosemite Weekend trip are created at startup. Jordan has no seeded trip access. Data resets when the server restarts. | Fast UI review, default automated tests, and demos that do not need persistence. |
| PostgreSQL mode | Set `DATABASE_URL` to a running PostgreSQL database. On macOS, use `./database/start_db_macos.sh` to start Docker PostgreSQL, write `.env`, apply the schema, and seed demo data. The seeded PostgreSQL demo password is `demo-password`. | The server logs `Database layer: connected`. Data is read from and written to PostgreSQL and persists across app restarts. | Persistence review, PostgreSQL repository smoke testing, and currency refresh/convert scripts. |

If `DATABASE_URL` is set manually for a new database, apply the schema before
starting the app:

```bash
npm run db:schema
```

The macOS Docker setup script does this automatically.

### macOS PostgreSQL Demo

This path verifies that TripSplit works against a real PostgreSQL database and
that data persists across app restarts.

Prerequisites:

- Docker Desktop is installed and running.
- Project dependencies are installed with `npm install`.

If Docker is installed but not running, start it:

```bash
docker desktop start
```

From the repo root:

```bash
./database/start_db_macos.sh
npm start
```

The setup script:

- starts a PostgreSQL Docker container on `localhost:5433`
- writes `.env` with a local `DATABASE_URL`
- applies `database/schema.sql`
- seeds demo users, an Alex/Sam friendship, the Alex/Sam San Diego trip, Sam's
  public Yosemite trip, budget, expenses, and expense shares

Seeded PostgreSQL demo accounts:

| Email | Password | Role |
| --- | --- | --- |
| `alex@example.com` | `demo-password` | Trip organizer |
| `sam@example.com` | `demo-password` | Trip participant and public trip organizer |
| `jordan@example.com` | `demo-password` | Non-friend social demo account |

Open `http://localhost:3000`, log in with one of the PostgreSQL demo accounts,
and confirm that the server logs `Database layer: connected`.

The terminal also reports currency refresh scheduler status on startup:

```text
Currency refresh scheduler: enabled; refresh on start: enabled; interval: 24 hours.
Exchange rates refreshed: stored ... USD rates from open.er-api.com; fetched at ...
```

If the app is started without `DATABASE_URL`, the scheduler does not refresh or
persist rates. Reviewers should instead see:

```text
Currency refresh scheduler: disabled because DATABASE_URL is not set or the database layer is not connected.
```

To verify persistence:

1. Add a trip or expense on the website.
2. Stop `npm start`.
3. Run `npm start` again.
4. Reopen the website and confirm the DB-backed data is still there.

To stop the DB container while keeping its data:

```bash
./database/end_db_macos.sh
```

To remove the container and delete all local DB data:

```bash
PURGE_TRIPSPLIT_DB=1 ./database/end_db_macos.sh
```

Additional Linux/SSH database-hosting notes are in
`database/db_setup_readme.md`.

### Automated Checks

Run:

```bash
npm test
```

The default suite should pass locally. The PostgreSQL smoke test is skipped by
default unless database testing is explicitly enabled.

To verify the PostgreSQL-backed path, start a disposable local database first,
then run:

```bash
npm run test:db
```

### Quick UI Demo With Seeded Data

1. Start the app in in-memory mode:

```bash
npm start
```

2. Open `http://localhost:3000`.
3. Log in as `alex@example.com` with password `Demo-password1!`.
4. Open the seeded San Diego Weekend trip.
5. Confirm that only Alex and Sam are listed as approved participants, and that
   the Budget, Expenses, and Balances panels are visible.
6. Confirm that Sam appears in the Friends sidebar and Yosemite Weekend appears
   in Trip Lobby.
7. Add a `personal_advance` expense. Confirm that personal reimbursement
   balances change.
8. Add a `budget_payment` expense as the organizer. Confirm that budget spending
   changes while personal reimbursement balances stay separate.
9. Delete an expense. Confirm that budget and balances recalculate. As the
   organizer, restore the deleted expense and confirm they update again.
10. Use the Balances panel to end the trip. Confirm that the final bill appears
   and budget/expense changes are locked.

### Multi-Account Social Demo

Use named sessions so one browser can keep several users logged in at once:

```text
http://localhost:3000/?session=alex
http://localhost:3000/?session=sam
http://localhost:3000/?session=jordan
```

Suggested flow:

1. Log in as Alex, Sam, and Jordan in separate named-session tabs.
2. From Alex, confirm Sam appears in the Friends sidebar and Sam's public
   Yosemite Weekend trip appears in Trip Lobby.
3. Confirm Jordan has no seeded trips or friends before the social demo steps.
4. From Alex, request to join Yosemite Weekend. From Sam, open Requests and
   accept the join request.
5. From Alex, send a friend request to Jordan using the Friends sidebar. From
   Jordan, open Requests and accept the friend request.
6. From Alex, create a public trip and invite Sam or Jordan. From the invited
   user's Requests dialog, accept or decline the invitation.
7. Create a new private trip as Alex and verify lifecycle controls:
   - Before starting, the organizer can edit trip details, set budget, and manage
     participants.
   - Expenses cannot be recorded until the trip starts.
   - After starting, trip details and participants are locked, and budget can
     only be increased.
   - After ending, budget and expenses are locked and the final bill is shown.

When `DATABASE_URL` is set, the app uses PostgreSQL repositories and does not
seed the in-memory demo data. If you did not use the local database setup script,
apply the schema before using a new database:

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
- `database/db_setup_readme.md`: local Docker PostgreSQL setup and persistence checks
- `database/schema.sql`: PostgreSQL schema source of truth
