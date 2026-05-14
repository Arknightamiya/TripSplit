# TripSplit Branch Plan

This document explains the current team split and branch structure for the TripSplit project.

## Main Branch Rule

The `main` branch should always stay runnable and demo-ready. Team members should not push directly to `main`.

All substantive code changes should go through pull requests. Each pull request should be reviewed by at least one other team member before merging.

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

- `web/`
- Frontend API helper files
- Shared frontend styling files

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

- `web/`
- Frontend render files
- Shared frontend styling files

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

- `server/router.js`
- `server/store.js`
- `server/db.js`
- `shared/contracts.js`

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

- `server/router.js`
- `server/store.js`
- `server/settlement.js`
- `tests/settlement.test.js`

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

## Integration Rule

Before connecting frontend and backend code, the team should agree on the API request and response format in `docs/api-contract.md`.

If two branches modify the same file, the branch owner should pull the latest `main` frequently and resolve conflicts early.