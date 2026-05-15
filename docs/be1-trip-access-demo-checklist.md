# BE1 Demo 2: Trip Persistence And Access Control

This is the second BE1 demo/checklist for TA review.

Branch:

```text
backend/be1-trip-access-persistence
```

This branch is stacked on top of the first BE1 PR branch:

```text
backend/be1-auth-trip-budget-api
```

The first BE1 PR covers slices 1-3. This second demo covers slices 4-5.

## Completed In This Demo

### Slice 4: PostgreSQL-Backed Trip Creation

When `DATABASE_URL` is configured:

- `POST /api/trips` inserts a trip into PostgreSQL table `trips`.
- The backend uses `req.user.id` from the JWT as the organizer.
- The frontend still should not send `organizerId`.
- The organizer is automatically inserted into `trip_participants`.
- The organizer participant row uses:
  - `role = 'organizer'`
  - `join_status = 'approved'`

Main file:

- `server/repositories/trips.js`

### Slice 5: PostgreSQL-Backed Trip List / Detail Access Control

When `DATABASE_URL` is configured:

- `GET /api/trips` lists only trips where the current user is an approved participant.
- `GET /api/trips/:tripId` checks that the trip exists.
- Non-participants are rejected with `403`.
- `ensureApprovedParticipant(userId, tripId)` uses PostgreSQL membership checks.
- `ensureOrganizer(userId, tripId)` uses PostgreSQL organizer checks.

Main files:

- `server/repositories/trips.js`
- `server/services/trips.js`
- `server/routes/trips.js`

## Files Changed

Important implementation files:

- `server/repositories/trips.js`
- `server/services/trips.js`
- `server/routes/trips.js`
- `server/services/expenses.js`
- `server/routes/expenses.js`
- `server/routes/balances.js`

Demo/documentation files:

- `docs/be1-trip-access-demo-checklist.md`

## Core Implementation Code

### Create Trip And Organizer Participant

The PostgreSQL trip repository creates the trip and inserts the organizer participant in one transaction:

```js
export async function createTripRecord({
  name,
  destination,
  startDate,
  endDate,
  organizerId
}) {
  const database = getDatabase();

  try {
    await database.query("BEGIN");

    const tripResult = await database.query(
      `
        INSERT INTO trips (name, destination, start_date, end_date, organizer_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [name, destination || null, startDate || null, endDate || null, organizerId]
    );
    const tripId = tripResult.rows[0].id;

    await database.query(
      `
        INSERT INTO trip_participants (trip_id, user_id, role, join_status)
        VALUES ($1, $2, 'organizer', 'approved')
      `,
      [tripId, organizerId]
    );

    await database.query("COMMIT");
    return findTripRecordById(tripId);
  } catch (error) {
    await database.query("ROLLBACK");
    throw error;
  }
}
```

What this proves:

- The backend, not the frontend, controls organizer assignment.
- Trip creation and organizer membership are treated as one database operation.
- The data model follows `database/schema.sql`.

### List Only Trips The User Belongs To

The PostgreSQL list query joins `trips` with `trip_participants`:

```js
export async function listTripSummaryRecordsForUser(userId) {
  const result = await getDatabase().query(
    `
      SELECT
        t.id,
        t.name,
        t.destination,
        t.start_date,
        t.end_date,
        t.organizer_id,
        b.mode,
        b.total_budget,
        b.per_person_budget,
        (
          SELECT COUNT(*)
          FROM trip_participants approved_tp
          WHERE approved_tp.trip_id = t.id
            AND approved_tp.join_status = 'approved'
        ) AS participant_count,
        (
          SELECT COUNT(*)
          FROM expenses e
          WHERE e.trip_id = t.id
        ) AS expense_count,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.trip_id = t.id
        ), 0) AS total_spent
      FROM trips t
      JOIN trip_participants tp ON tp.trip_id = t.id
      LEFT JOIN budgets b ON b.trip_id = t.id
      WHERE tp.user_id = $1
        AND tp.join_status = 'approved'
      ORDER BY t.created_at DESC, t.id DESC
    `,
    [userId]
  );

  return result.rows.map(mapTripSummaryRow);
}
```

What this proves:

- Users do not receive every trip in the database.
- A user only sees trips where they are an approved participant.
- The response can include budget summary fields once budgets are persisted.

### PostgreSQL Membership And Organizer Checks

The access-control helpers now have PostgreSQL-backed checks:

```js
export async function userIsApprovedParticipantRecord(userId, tripId) {
  const result = await getDatabase().query(
    `
      SELECT 1
      FROM trip_participants
      WHERE trip_id = $1
        AND user_id = $2
        AND join_status = 'approved'
    `,
    [tripId, userId]
  );

  return Boolean(result.rows[0]);
}

export async function userIsOrganizerRecord(userId, tripId) {
  const result = await getDatabase().query(
    `
      SELECT 1
      FROM trip_participants
      WHERE trip_id = $1
        AND user_id = $2
        AND role = 'organizer'
        AND join_status = 'approved'
    `,
    [tripId, userId]
  );

  return Boolean(result.rows[0]);
}
```

What this proves:

- BE2 can depend on `ensureApprovedParticipant(userId, tripId)`.
- Organizer-only routes can depend on `ensureOrganizer(userId, tripId)`.
- Access control is based on `trip_participants`, not frontend input.

### Service Layer Chooses PostgreSQL Or In-Memory Fallback

`server/services/trips.js` uses PostgreSQL when the repository is enabled:

```js
export async function createTripForUser(userId, input = {}) {
  requireFields(input, ["name"]);

  if (isTripRepositoryEnabled()) {
    return {
      trip: await createTripRecord({
        name: input.name,
        destination: input.destination,
        startDate: input.startDate,
        endDate: input.endDate,
        organizerId: userId
      })
    };
  }

  return {
    trip: createTrip({
      name: input.name,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      organizerId: userId
    })
  };
}
```

What this proves:

- Local tests still work without PostgreSQL.
- The production path is ready to use PostgreSQL when `DATABASE_URL` is configured.
- API response shapes stay the same.

## Test Result

Latest command:

```bash
npm test
```

Latest result:

```text
tests 11
pass 11
fail 0
cancelled 0
skipped 0
todo 0
```

Important tests still passing:

```text
private trip APIs require bearer auth
login returns JWT and lists trips for the authenticated participant
register returns a JWT and starts with no private trips
duplicate registration is rejected
trip creation uses the token user as organizer
non-participant cannot view private trip details
organizer can add participants by email
regular participants cannot add participants or set budgets
organizer can set total and per-person budgets
expense API creates equal shares and recalculates balances
calculateBalances splits shared expenses fairly
```

## What The Tests Prove For This Demo

The current automated tests still run without PostgreSQL by using the in-memory fallback. They prove that the public API behavior did not regress while the PostgreSQL trip repository was added:

1. Private APIs still require bearer auth.
2. The JWT user is still used as trip organizer.
3. Non-participants are still blocked from private trip details.
4. Organizer-only behavior still works.
5. Budget and expense regression behavior still passes.

The PostgreSQL path itself is implemented but still needs real database verification after local PostgreSQL or a hosted PostgreSQL URL is configured.

## Manual Demo Commands

Start from this branch:

```bash
git switch backend/be1-trip-access-persistence
git pull origin backend/be1-trip-access-persistence
npm install
npm test
```

Check database configuration:

```bash
npm run db:check
```

Expected result on the current machine:

```text
DATABASE_URL is not set. PostgreSQL is not enabled.
```

Start the app:

```bash
npm run dev
```

Login:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@example.com","password":"demo-password"}'
```

Create trip without `organizerId`:

```bash
curl -s -X POST http://localhost:3000/api/trips \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"TA Demo Trip","destination":"Los Angeles","startDate":"2026-06-01","endDate":"2026-06-03"}'
```

Expected result:

- Response includes `organizerId`.
- The value comes from the JWT user, not from frontend input.

## PostgreSQL Setup For Real DB Verification

Create a local database:

```bash
createdb tripsplit
```

Create `.env`:

```env
DATABASE_URL=postgresql://YOUR_LOCAL_USERNAME@localhost:5432/tripsplit
JWT_SECRET=local-dev-secret
PORT=3000
CORS_ORIGIN=http://localhost:3000
```

Apply schema:

```bash
npm run db:schema
```

Check connection:

```bash
npm run db:check
```

Current environment note:

- `psql`, `createdb`, and `pg_isready` are not installed on this machine yet.
- Real PostgreSQL verification still requires local PostgreSQL setup or a hosted PostgreSQL URL.

## What Still Belongs To Later BE1 Slices

Not completed in this demo:

1. Slice 6: PostgreSQL-backed participant management.
2. Slice 7: PostgreSQL-backed budget persistence.

Until those slices are completed:

- `POST /api/trips/:tripId/participants` is not yet PostgreSQL-backed.
- `POST /api/trips/:tripId/budget` is not yet PostgreSQL-backed.

## Why This Matters For BE2

Once this branch is reviewed and merged after the first BE1 PR, BE2 can depend on:

- `req.user.id` as the authenticated user.
- PostgreSQL-backed `users`.
- PostgreSQL-backed `trips`.
- PostgreSQL-backed organizer rows in `trip_participants`.
- `ensureApprovedParticipant(userId, tripId)`.
- `ensureOrganizer(userId, tripId)`.

That gives BE2 the membership and organizer checks needed for expense APIs and settlement logic.
