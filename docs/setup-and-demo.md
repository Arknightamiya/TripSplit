# Setup and demo guide

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


Return to the [project overview](../README.md). Commands in this guide run from the repository root.
