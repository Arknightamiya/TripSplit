# TripSplit Branch Plan

This document explains the current team split and branch structure for the TripSplit project.

## Main Branch Rule

The `main` branch should always stay runnable and demo-ready. Team members should not push directly to `main`.

All substantive code changes should go through pull requests. Each pull request should be reviewed by at least one other team member before merging.

The current scaffold uses plain JavaScript modules in `web/` and an Express backend in `server/`. Team members should build on the existing JavaScript templates unless the whole team agrees to a framework migration.

Before implementing feature work, read `docs/integration-baseline.md`. The API contract in `docs/api-contract.md` and the PostgreSQL target schema in `database/schema.sql` are the shared source of truth for integration.

Also read `docs/reference-architecture-notes.md` for the architecture patterns borrowed from the prior BruinDating project. Borrow the structure discipline, not the dating-app features or exact stack.

## Team Split

### FE 1: Auth Pages + Trip Dashboard

**Branch:** `frontend/fe1-auth-trip-dashboard`

**Responsibilities:**

- Auth pages UI
- Trip dashboard
- Trip list
- Create trip UI
- Invite participant UI

**Main files likely affected:**

- `web/app.js`
- `web/forms.js`
- `web/renderTrips.js`
- `web/api.js`
- auth UI files added under `web/`
- trip dashboard UI files added under `web/`

---

### FE 2: Budget + Expense + Balance UI

**Branch:** `frontend/fe2-budget-expense-balance-ui`

**Responsibilities:**

- Budget UI
- Expense entry UI
- Expense ledger UI
- Final balance summary UI
- Shared styling support

**Main files likely affected:**

- `web/api.js`
- `web/renderBudget.js`
- `web/renderExpenses.js`
- `web/renderBalances.js`
- expense form and ledger files added under `web/`
- balance summary files added under `web/`

---

### BE 1: Auth + Trip + Participant + Budget APIs

**Branch:** `backend/be1-auth-trip-budget-api`

**Responsibilities:**

- Auth / JWT
- Access control
- Trip APIs
- Participant APIs
- Budget APIs

**Main files likely affected:**

- `server/routes/auth.js`
- `server/routes/trips.js`
- `server/services/auth.js`
- `server/services/trips.js`
- `server/middleware/auth.js`
- `server/db/pool.js`
- `server/store.js` until PostgreSQL persistence replaces it
- `shared/contracts.js`

**Route ownership:**

- `/api/auth/*`
- `/api/trips`
- `/api/trips/:tripId`
- `/api/trips/:tripId/participants`
- `/api/trips/:tripId/budget`

---

### BE 2: Expense + Settlement APIs

**Branch:** `backend/be2-expense-settlement-api`

**Responsibilities:**

- Expense APIs
- ExpenseShare logic
- Settlement / balance logic
- Delete expense
- Recalculation after expense changes

**Main files likely affected:**

- `server/routes/expenses.js`
- `server/routes/balances.js`
- `server/services/expenses.js`
- `server/settlement.js`
- `server/store.js` until PostgreSQL persistence replaces it
- `tests/settlement.test.js`
- `tests/api.test.js`

**Route ownership:**

- `/api/trips/:tripId/expenses`
- `/api/trips/:tripId/expenses/:expenseId`
- `/api/trips/:tripId/balances`

---

### Integrator / Shared

**Branch:** `shared/integration-testing`

**Responsibilities:**

- PostgreSQL schema
- API contract documentation
- API integration support
- Shared theme / common styling support
- Testing
- PR review / merge support

**Main files likely affected:**

- `docs/api-contract.md`
- `docs/branch-plan.md`
- `database/schema.sql`
- `shared/contracts.js`
- `tests/`
- `README.md`
- `web/styles.css`
- shared frontend API helpers such as `web/api.js`

## Integration Rule

Before connecting frontend and backend code, the team should agree on the API request and response format in `docs/api-contract.md`.

If two branches modify the same file, the branch owner should pull the latest `main` frequently and resolve conflicts early.

Files expected to be shared hotspots:

- `server/app.js`
- `server/routes/`
- `server/services/`
- `server/store.js`
- `web/api.js`
- `web/styles.css`
- `shared/contracts.js`

Before changing one of these shared files, check whether another teammate is already editing the same area. Prefer adding clearly separated functions or route sections instead of rewriting unrelated code.

## Shared Architecture Rules

- Frontend modules should call `web/api.js` instead of hardcoding `fetch` endpoints in render or form files.
- Endpoint paths, auth header names, token storage keys, and shared enum values should come from `shared/contracts.js`.
- Backend route work should keep auth, trip, participant, budget, expense, and balance logic separated by Express route and service modules.
- Settlement logic should stay testable outside HTTP routing.
- Pull requests that change shared request/response shapes must update `docs/api-contract.md`.
- Pull requests that change database relationships must update `database/schema.sql`.
- Pull requests that change shared styling assumptions must coordinate through `web/styles.css`.
