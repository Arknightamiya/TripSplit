# Cloud Database Verification

This document records the cloud PostgreSQL setup and verification work for TripSplit.

## Summary

TripSplit now has a hosted PostgreSQL database for real database verification. The database is hosted on Neon and uses the existing project schema from `database/schema.sql`.

The cloud database connection string is stored locally in `.env` as `DATABASE_URL`. It is intentionally not committed to GitHub because it contains a database password.

## Environment

- Provider: Neon PostgreSQL
- Database: `neondb`
- Schema source: `database/schema.sql`
- Local environment variable: `DATABASE_URL`
- Secret handling: `.env` is ignored by Git through `.gitignore`

## Commands Run

Applied the schema:

```bash
npm run db:schema
```

Result:

```text
Applied database/schema.sql successfully.
```

Checked the database connection:

```bash
npm run db:check
```

Result:

```text
Connected to PostgreSQL database: neondb
```

Ran the automated test suite:

```bash
npm test
```

Result:

```text
tests 21
pass 21
fail 0
```

## Real Database Smoke Test

A real cloud database smoke test was run through the Express API using the Neon PostgreSQL connection.

The smoke test covered:

1. Register user
2. Login user
3. Create trip
4. Add participant
5. Set budget
6. Add expense
7. Get balances
8. Delete expense

Result:

```text
Cloud DB smoke test passed.
```

## What This Verifies

This verifies that the backend can run against a real PostgreSQL database, not only the in-memory fallback used by local tests.

The verified database-backed tables include:

- `users`
- `trips`
- `trip_participants`
- `budgets`
- `expenses`
- `expense_shares`

This also verifies that BE1 and BE2 are aligned on the shared database schema:

- BE1 writes trip participants to `trip_participants`.
- BE1 writes trip budgets to `budgets`.
- BE2 reads approved participants from `trip_participants`.
- BE2 reads budget data from `budgets` when returning `budgetSummary`.
- BE2 writes expenses and expense shares to `expenses` and `expense_shares`.

## Notes

- Do not commit `.env`.
- Do not paste `DATABASE_URL` into GitHub, tracker docs, or group chat.
- The cloud database can now be used for manual demo verification and future deployment testing.
