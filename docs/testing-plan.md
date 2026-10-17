# TripSplit Testing Plan

## Current Test Setup

The project uses Node's built-in test runner. Run the default suite with:

```bash
npm test
```

The default script is defined in `package.json` as:

```bash
NODE_ENV=test node --test
```

The default suite runs against the in-memory data path and intentionally skips
the real PostgreSQL smoke test unless database testing is explicitly enabled.

## Current Automated Coverage

Automated coverage currently includes:

- auth, registration, verification-code resend, login by email or User ID, JWT
  session errors, password policy, and duplicate registration handling
- profile update validation for display names and avatar data URLs
- per-window and named-session auth storage behavior
- friend requests, friend search, bidirectional friend removal, public trip
  lobby visibility, trip join requests, and trip invitations
- trip create, detail, update, delete, public/private visibility, date
  validation, organizer-only permissions, participant management, and pending
  invitation behavior
- trip lifecycle behavior: start trip, end trip, metadata locks, participant
  locks, budget locks, and expense locks
- total and per-person budgets, budget validation, increasing started-trip
  budgets, and mixed-currency budget-payment conversion
- expense creation for `budget_payment` and `personal_advance`, equal shares,
  cent rounding, split participant validation, payer validation, duplicate split
  participant normalization, soft-delete, restore, and permission checks
- balance and settlement calculations, including separation of shared-budget
  spending from personal reimbursement balances
- rendered balance transfer helpers and display-currency conversion behavior
- currency selector display helpers and fallback currency conversion
- currency refresh scheduler behavior, including disabled/no-database cases and
  logged refresh failures
- real-world API smoke scenarios covering invitations, public join flows,
  budgets, expenses, balances, outsider rejection, and participant expense
  deletion

Primary test files:

- `tests/api.test.js`
- `tests/real-world-scenarios.test.js`
- `tests/settlement.test.js`
- `tests/render-balances.test.js`
- `tests/currency-display.test.js`
- `tests/session-storage.test.js`
- `tests/currency-refresh-scheduler.test.js`
- `tests/helpers/api.js`

## PostgreSQL Smoke Test

The PostgreSQL repository path is covered by an explicit opt-in smoke test:

```bash
npm run test:db
```

`test:db` loads `.env`, sets `TRIPSPLIT_DATABASE_SMOKE=1`, and runs
`tests/database-smoke.test.js`. Use a disposable PostgreSQL database with
`database/schema.sql` already applied. A successful real DB run should report
`pass 1` and `skipped 0`.

The smoke test verifies that the PostgreSQL-backed API path can perform the
core user, trip, budget, expense, and balance workflow against the real schema.

## Manual Verification

The primary reviewer-facing manual workflow is now in the [setup and demo guide](setup-and-demo.md) under
`Reviewer/Verification Guide`. Use that section for TA/professor demos because
it includes:

- choosing in-memory mode or PostgreSQL mode
- macOS Docker PostgreSQL setup
- seeded demo accounts for both modes
- persistence verification
- automated test commands
- quick UI demo steps
- multi-account social demo steps
- trip lifecycle lock checks

Condensed manual smoke checklist:

1. Start the app in the intended data mode.
2. Log in with the appropriate seeded demo password for that mode.
3. Open or create a trip.
4. Verify friend request, public trip lobby, invitation, and join-request flows.
5. Set a budget and confirm total/per-person behavior.
6. Start the trip and confirm expenses can now be recorded.
7. Add a `personal_advance` expense and confirm personal balances change.
8. Add a `budget_payment` expense and confirm budget spending changes while
   personal reimbursement balances stay separate.
9. Delete and restore an expense and confirm budget/balances recalculate.
10. End the trip and confirm budget and expense changes are locked.

## Remaining Risk Areas

The current automated suite is broad, but these areas still benefit from manual
or future browser-level checks:

- complete visual QA across desktop and narrow mobile viewports
- browser interaction around modal focus, date segmented inputs, avatar upload,
  and multi-tab named sessions
- long-running PostgreSQL persistence beyond the smoke workflow
- real email delivery through Gmail SMTP, since local review usually relies on
  terminal-printed verification codes
- live exchange-rate provider failures outside the mocked scheduler tests
