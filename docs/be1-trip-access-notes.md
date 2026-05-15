# BE1 Trip Persistence And Access Notes

This document covers the BE1 follow-up work for slices 4 and 5.

## Completed In This Slice

### Slice 4: Trip Creation And Trip Participants Persistence

When `DATABASE_URL` is configured, BE1 now has a PostgreSQL-backed trip path:

- `POST /api/trips` inserts into `trips`.
- The backend uses `req.user.id` from JWT as the organizer.
- The frontend still should not send `organizerId`.
- The organizer is inserted into `trip_participants`.
- The organizer participant row uses:
  - `role = 'organizer'`
  - `join_status = 'approved'`

Implementation file:

- `server/repositories/trips.js`

### Slice 5: Trip List / Detail Access Control

When `DATABASE_URL` is configured:

- `GET /api/trips` lists only trips where the current user is an approved participant.
- `GET /api/trips/:tripId` checks that the trip exists.
- Non-participants are rejected with `403`.
- `ensureApprovedParticipant(userId, tripId)` uses PostgreSQL membership checks.
- `ensureOrganizer(userId, tripId)` uses PostgreSQL organizer checks.

Implementation files:

- `server/repositories/trips.js`
- `server/services/trips.js`
- `server/routes/trips.js`

## What Still Belongs To Later BE1 Slices

These are not completed in this slice:

- Slice 6: PostgreSQL-backed participant management.
- Slice 7: PostgreSQL-backed budget persistence.

Until those slices are completed, `POST /api/trips/:tripId/participants` and `POST /api/trips/:tripId/budget` still use the in-memory fallback when PostgreSQL is not enabled.

## Validation

Latest validation:

```bash
npm test
```

Result:

```text
tests 11
pass 11
fail 0
```

Also verified:

```bash
git diff --check
```

No whitespace errors.

## Environment Note

The current machine still does not have local PostgreSQL CLI tools installed (`psql`, `createdb`, `pg_isready`). Real database connection testing still requires local PostgreSQL setup or a hosted PostgreSQL URL.
