# BE1 Demo Checklist

This checklist records what BE1 can show for the next TA/demo discussion.

## Demo Goal

Show that the backend foundation is no longer only a starter scaffold. It now has Express routes, JWT auth, private route protection, trip access control, organizer-only actions, and budget behavior that matches the API contract.

## What BE1 Owns

- Auth APIs:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- JWT middleware:
  - `server/middleware/auth.js`
  - private APIs require `Authorization: Bearer <token>`
- Trip APIs:
  - `GET /api/trips`
  - `POST /api/trips`
  - `GET /api/trips/:tripId`
- Participant API:
  - `POST /api/trips/:tripId/participants`
- Budget API:
  - `POST /api/trips/:tripId/budget`

## Demo Talking Points

- The frontend does not send `organizerId` when creating a trip.
- The backend reads the current user from the JWT and sets that user as the organizer.
- Private trip data is blocked without a bearer token.
- Non-participants cannot view private trip details.
- Regular participants cannot add participants or update trip budgets.
- Organizers can add participants and set total or per-person budgets.
- PostgreSQL has a pool boundary in `server/db/pool.js`; the next BE1 step is replacing the in-memory store internals with PostgreSQL queries for users, trips, trip participants, and budgets.

## Automated Evidence

Run:

```bash
npm test
```

Current BE1-relevant tests cover:

- private trip APIs require bearer auth
- login returns a JWT
- register returns a JWT
- duplicate registration returns `409`
- trip creation uses token user as organizer
- non-participant trip access returns `403`
- organizer can add participant
- regular participant cannot add participants or set budgets
- organizer can set total and per-person budgets

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
