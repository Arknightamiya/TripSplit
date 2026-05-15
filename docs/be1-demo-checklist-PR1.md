# BE1 PR 1 Demo And Test Notes

This checklist is for the first BE1 demo scope in the current BE1 development branch.

Current BE1 branch:

```text
backend/be1-trip-access-persistence
```

Historical PR1 branch:

```text
backend/be1-auth-trip-budget-api
```

PR1 has already been merged into `main`; the current BE1 branch includes that PR1 work plus the later PR2 work. For the TA demo, use this document to present only slices 1-3.

## Completed In This PR

This PR completes the first three BE1 slices:

1. BE1 behavior baseline and demo coverage
   - Added automated tests for auth, trip access control, participant permissions, and budget permissions.
   - Added this demo/test document for TA review.

2. PostgreSQL local setup support
   - Added `npm run db:schema` to apply `database/schema.sql`.
   - Added `npm run db:check` to verify whether PostgreSQL is configured.
   - Updated `server/db/pool.js` to expose a reusable database connection boundary.

3. PostgreSQL-backed auth/user persistence path
   - Added `server/repositories/users.js`.
   - `POST /api/auth/register` can insert into PostgreSQL `users` when `DATABASE_URL` is configured.
   - `POST /api/auth/login` can read from PostgreSQL `users` when `DATABASE_URL` is configured.
   - Without `DATABASE_URL`, the app keeps using the in-memory fallback so local tests and demos still run.

## Test Code

The main test file is `tests/api.test.js`.

Core BE1 tests:

```js
test("private trip APIs require bearer auth", async () => {
  const response = await request("/api/trips");

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    error: "Missing or invalid token"
  });
});

test("login returns JWT and lists trips for the authenticated participant", async () => {
  const { token } = await loginAsDemoUser();

  const response = await request("/api/trips", {
    headers: authHeaders(token)
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.trips.length, 1);
  assert.equal(response.body.trips[0].name, "San Diego Weekend");
  assert.equal(response.body.trips[0].budgetSummary.totalBudget, 900);
});

test("register returns a JWT and starts with no private trips", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Taylor New",
      email: "taylor@example.com",
      password: "demo-password"
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, "taylor@example.com");
  assert.equal(response.body.token.split(".").length, 3);

  const tripsResponse = await request("/api/trips", {
    headers: authHeaders(response.body.token)
  });

  assert.equal(tripsResponse.status, 200);
  assert.deepEqual(tripsResponse.body.trips, []);
});

test("duplicate registration is rejected", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      name: "Alex Duplicate",
      email: "alex@example.com",
      password: "demo-password"
    }
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "An account with this email already exists"
  });
});

test("trip creation uses the token user as organizer", async () => {
  const { token, user } = await loginAsDemoUser();

  const response = await request("/api/trips", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Joshua Tree",
      destination: "Joshua Tree",
      organizerId: "user_999"
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.trip.organizerId, user.id);
  assert.deepEqual(response.body.trip.participantIds, [user.id]);
});

test("non-participant cannot view private trip details", async () => {
  const organizer = await loginAsDemoUser();
  const tripId = await createTrip(organizer.token);
  const outsider = await registerUser({
    name: "Outsider",
    email: "outsider@example.com"
  });

  const response = await request(`/api/trips/${tripId}`, {
    headers: authHeaders(outsider.token)
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    error: "You are not an approved participant on this trip"
  });
});

test("organizer can add participants by email", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const response = await request(`/api/trips/${tripId}/participants`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      name: "Riley Traveler",
      email: "riley@example.com",
      role: "participant"
    }
  });

  assert.equal(response.status, 200);
  const participant = response.body.trip.participants.find(
    (entry) => entry.email === "riley@example.com"
  );
  assert.equal(participant.role, "participant");
  assert.equal(participant.joinStatus, "approved");
});

test("regular participants cannot add participants or set budgets", async () => {
  const { token } = await loginAsDemoUser({
    email: "sam@example.com",
    password: "demo-password"
  });
  const tripId = "trip_4";

  const addParticipantResponse = await request(
    `/api/trips/${tripId}/participants`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: {
        name: "Blocked Guest",
        email: "blocked@example.com"
      }
    }
  );
  const budgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      totalBudget: 1000
    }
  });

  assert.equal(addParticipantResponse.status, 403);
  assert.equal(budgetResponse.status, 403);
  assert.deepEqual(budgetResponse.body, {
    error: "Only an organizer can perform this action"
  });
});

test("organizer can set total and per-person budgets", async () => {
  const { token } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const totalBudgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "total",
      totalBudget: 1200
    }
  });
  const perPersonBudgetResponse = await request(`/api/trips/${tripId}/budget`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      mode: "per-person",
      perPersonBudget: 400
    }
  });

  assert.equal(totalBudgetResponse.status, 200);
  assert.equal(totalBudgetResponse.body.budgetSummary.totalBudget, 1200);
  assert.equal(totalBudgetResponse.body.budgetSummary.perPersonBudget, null);
  assert.equal(perPersonBudgetResponse.status, 200);
  assert.equal(perPersonBudgetResponse.body.budgetSummary.totalBudget, 400);
  assert.equal(perPersonBudgetResponse.body.budgetSummary.perPersonBudget, 400);
});
```

Shared regression tests also run in the same suite:

```js
test("expense API creates equal shares and recalculates balances", async () => {
  const { token, user } = await loginAsDemoUser();
  const tripId = await createTrip(token);

  const response = await request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      title: "Lunch",
      amount: 30,
      category: "food",
      expenseType: "shared",
      payerId: user.id,
      splitRule: "equal",
      includedParticipantIds: [user.id]
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.expense.expenseShares[0].shareAmount, 30);
  assert.equal(response.body.balances[0].actualPaid, 30);
  assert.equal(response.body.balances[0].fairShare, 30);
  assert.equal(response.body.balances[0].netBalance, 0);
});
```

## Before The TA Demo

Use the current BE1 branch that contains the full BE1 work-in-progress, then present only this PR1 checklist for slices 1-3:

```bash
git switch backend/be1-trip-access-persistence
git pull --ff-only origin backend/be1-trip-access-persistence
npm install
npm test
```

Open this file for the PR1 demo:

```text
docs/be1-demo-checklist-PR1.md
```

For this demo, only present the PR1 scope:

- Slice 1: BE1 behavior baseline and demo coverage
- Slice 2: PostgreSQL local setup support
- Slice 3: PostgreSQL-backed auth/user persistence path

Do not present slices 4-5 in this demo. Those belong to the second BE1 demo checklist.

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

Detailed result:

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

## What Each Test Proves

1. Private trip APIs require bearer auth
   - Confirms private trip routes reject missing `Authorization: Bearer <token>`.
   - Expected status: `401`.

2. Login returns JWT and lists trips for the authenticated participant
   - Confirms `POST /api/auth/login` returns a token.
   - Confirms authenticated users can list only trips they participate in.

3. Register returns a JWT and starts with no private trips
   - Confirms `POST /api/auth/register` returns `{ user, token }`.
   - Confirms a new user does not automatically see trips they do not belong to.

4. Duplicate registration is rejected
   - Confirms duplicate email registration returns `409`.
   - This protects the future PostgreSQL `users.email UNIQUE` rule.

5. Trip creation uses the token user as organizer
   - The request body intentionally includes a fake `organizerId`.
   - The backend ignores it and uses the JWT user as the organizer.
   - This proves frontend should not send `organizerId`.

6. Non-participant cannot view private trip details
   - Confirms an authenticated outsider still cannot view another trip.
   - Expected status: `403`.

7. Organizer can add participants by email
   - Confirms organizer-only participant management works.
   - Confirms added participant receives role `participant` and join status `approved`.

8. Regular participants cannot add participants or set budgets
   - Confirms normal participants are blocked from organizer-only APIs.
   - Expected status: `403`.

9. Organizer can set total and per-person budgets
   - Confirms both budget modes from `docs/api-contract.md` work.
   - Confirms the response uses the shared `budgetSummary` shape.

10. Expense API creates equal shares and recalculates balances
    - This is mainly a shared regression test for BE2 integration.
    - It confirms the BE1 auth/trip setup still supports expense workflows.

11. calculateBalances splits shared expenses fairly
    - This is the settlement unit test.
    - It protects the shared balance formula used by BE2.

## PostgreSQL Auth Status

Auth now supports PostgreSQL-backed users when `DATABASE_URL` is configured:

- `POST /api/auth/register` inserts into `users`.
- `POST /api/auth/login` reads from `users`.
- duplicate email checks use the database.
- password hashes are stored in `users.password_hash`.
- JWT response shape stays `{ user, token }`.

When `DATABASE_URL` is not configured, the app keeps using the in-memory store so local tests and demos can still run quickly.

## Local PostgreSQL Setup

BE1 uses `database/schema.sql` as the source of truth for PostgreSQL.

Create a local database:

```bash
createdb tripsplit
```

Create a local `.env` file:

```env
DATABASE_URL=postgresql://YOUR_LOCAL_USERNAME@localhost:5432/tripsplit
JWT_SECRET=local-dev-secret
PORT=3000
CORS_ORIGIN=http://localhost:3000
```

Apply the schema:

```bash
npm run db:schema
```

Check the connection:

```bash
npm run db:check
```

Current machine note:

- `psql`, `createdb`, and `pg_isready` are not installed on this machine yet.
- `npm run db:check` still passes in no-DB mode and reports that PostgreSQL is not enabled.
- Real PostgreSQL verification is the next environment setup step.

## Manual Demo Commands

Start the app:

```bash
npm run dev
```

Health check:

```bash
curl -s http://localhost:3000/api/health
```

Private API without token should fail:

```bash
curl -s -i http://localhost:3000/api/trips
```

Login:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@example.com","password":"demo-password"}'
```

Use the returned token for private APIs:

```bash
curl -s http://localhost:3000/api/trips \
  -H 'Authorization: Bearer <token>'
```

Create trip without `organizerId`:

```bash
curl -s -X POST http://localhost:3000/api/trips \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"TA Demo Trip","destination":"Los Angeles","startDate":"2026-06-01","endDate":"2026-06-03"}'
```

Expected result: response contains `organizerId` from the token user.

## Next BE1 Work

The next BE1 slices are:

1. PostgreSQL-backed trip creation and `trip_participants`.
2. PostgreSQL-backed trip list/detail access control.
3. PostgreSQL-backed participant management.
4. PostgreSQL-backed budget persistence.

After slices 4 and 5 are complete, BE2 can rely on real PostgreSQL users, trips, and trip participants for independent expense development.
