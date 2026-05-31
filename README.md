# TripSplit

TripSplit is a CS130 project web application for shared travel budgeting and fair expense splitting.

It is designed for small groups traveling together, such as friends, roommates, student clubs, or campus organizations. The goal of TripSplit is to help a group create a trip, set a budget, record shared expenses, track spending during the trip, and calculate final balances for each participant.

## Team

Team Name: XZWSD

## Current Integration Baseline

The shared implementation baseline is documented in:

- `docs/integration-baseline.md`
- `docs/reference-architecture-notes.md`
- `docs/api-contract.md`
- `database/schema.sql`
- `docs/branch-plan.md`

The API contract and PostgreSQL schema are the source of truth for feature branches. Frontend and backend work should use the same field names, response shapes, access-control assumptions, and database relationships defined there.

The reference architecture notes summarize reusable structure lessons from the prior BruinDating project, including central API helpers, auth state, protected routes, backend domain separation, shared theme discipline, and environment configuration.

The backend starter now uses Express routes, middleware, services, JWT auth, and a PostgreSQL pool boundary. Persistence is still in memory until the backend feature branches replace the store internals with PostgreSQL queries.

## Project Motivation

Group travel often creates financial confusion. Before a trip, travelers may agree on a total budget or a per-person budget. During the trip, different people may pay for hotels, food, transportation, tickets, drinks, or emergency purchases.

Without a shared system, groups often rely on spreadsheets, notes, or chat messages. These methods can become hard to maintain and may lead to mistakes when calculating who paid for what and who still owes money.

TripSplit provides one shared place for trip budgeting, expense tracking, and final settlement calculation.

## Core Features

The MVP focuses on four main workflows:

1. Create a trip

   A trip organizer can create a trip with a name, destination, start date, and end date. The organizer can invite or add other participants.

2. Set a budget

   The trip organizer can set either a total trip budget or a per-person budget. The system tracks total spending, remaining budget, and over-budget amount.

3. Record shared expenses

   A trip participant can record an expense by entering the title, amount, category, payer, expense type, and selected participants included in the split.

4. View final balances

   Each participant can view their actual paid amount, fair share amount, and final net balance. A positive balance means the participant paid more than their fair share, while a negative balance means the participant paid less than their fair share.

## Non-Goals

TripSplit does not include the following features in the MVP:

- Integrated payment processing
- Direct money transfer
- Automatic charging
- Long-term household budgeting
- Recurring shared bills outside a trip context
- Social media-style interaction features

Actual payment or money transfer should be completed through external tools such as banking apps, Venmo, Zelle, or credit/debit cards.

## Tech Stack

Planned technology stack:

- Frontend: React
- Backend: Node.js with Express
- Database: PostgreSQL
- Authentication: JWT-based authentication
- API Style: REST API
- Testing:
  - Unit tests for settlement logic
  - Integration tests for core API workflows

## Main Data Model

The main system entities are:

- User
- Trip
- TripParticipant
- Budget
- Expense
- ExpenseShare
- SplitRule
- BalanceSummary

The core settlement formula is:

net balance = actual paid amount - fair share amount

A positive net balance means the participant paid more than their fair share.

A negative net balance means the participant paid less than their fair share.

## Planned REST APIs

The system will use REST APIs between the React frontend and Express backend.

Important planned endpoints include:

- POST /auth/register
- POST /auth/register/verify
- POST /auth/register/resend-code
- POST /auth/login
- GET /trips
- POST /trips
- POST /trips/{tripId}/participants
- GET /trips/{tripId}
- POST /trips/{tripId}/budget
- POST /trips/{tripId}/expenses
- GET /trips/{tripId}/balances
- DELETE /trips/{tripId}/expenses/{expenseId}

All private trip APIs require authentication. Users who are not approved participants should not be able to access or modify private trip data.


## How to Run the Project

The repo includes a lightweight runnable scaffold that matches the planned MVP architecture.

1. Make the startup script executable once:

```bash
chmod +x start.sh
```

2. Start the app:

```bash
./start.sh
```

3. Open:

```text
http://localhost:3000
```

You can also run:

```bash
npm test
```

to verify the settlement logic placeholder.

## Project Structure

The scaffold uses a mostly flat structure so the team can move quickly in CS130 while still leaving room to grow:

```text
TripSplit/
├── package.json
├── start.sh
├── server/
│   ├── app.js
│   ├── db.js
│   ├── db/
│   │   └── pool.js
│   ├── index.js
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── settlement.js
│   └── store.js
├── shared/
│   └── contracts.js
├── web/
│   ├── api.js
│   ├── app.js
│   ├── index.html
│   └── styles.css
└── tests/
    └── settlement.test.js
```

## Architecture Notes

- `server/`
  - Runs an Express backend now.
  - Keeps app creation, routes, middleware, services, database boundary, in-memory data, and settlement logic separated so backend branches can migrate service internals cleanly to PostgreSQL.

- `web/`
  - Provides an intentionally minimal frontend shell with a single input and button.
  - Can later be replaced by a React app with the same REST endpoints.

- `shared/`
  - Stores API contracts and constants that both the frontend and backend can reference.

- `tests/`
  - Covers settlement logic and key API workflows such as auth, private trip access, trip creation, expense shares, and balance recalculation.

## Current Scaffold Scope

The current scaffold intentionally keeps things small:

- Backend persistence is in memory only
- PostgreSQL hookup exists as a pool boundary in `server/db/pool.js`; it no-ops until `DATABASE_URL` is set and services start using it
- Authentication uses starter JWT behavior with seeded demo users
- Frontend is an intentionally tiny starter UI rather than full React
- The REST route shape already follows the planned API direction from this README

This gives the team a working baseline now, while keeping the path open for:

- React frontend setup
- PostgreSQL integration
- JWT auth hardening
- Broader unit and integration testing
