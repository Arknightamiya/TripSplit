# TripSplit Database Setup

These scripts run PostgreSQL in Docker and keep the data outside the container in a repo-local ignored folder:

```text
.tripsplit-postgres-data/
```

That means you can stop the Node app, start it again, and see DB-backed data persist.

## macOS Local DB

Prerequisites:

Run this on Mac:
```
docker desktop start
```

- Docker Desktop is installed and running.
- Project dependencies are installed with `npm install`.

From the repo root:

```bash
./database/start_db_macos.sh
npm start
```

Then open:

```text
http://localhost:3000
```

The script:

- starts a local PostgreSQL Docker container on `localhost:5433`
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

The PostgreSQL seed password differs from the in-memory demo password in the
main README. Use `demo-password` when `DATABASE_URL` is set by the database
setup script.

Seeded social state:

- Alex and Sam are friends.
- The seeded San Diego Weekend trip includes Alex and Sam only.
- Sam owns a public Yosemite Weekend trip that Alex can discover in Trip Lobby.
- Jordan starts as a non-friend with no seeded trip access so reviewers can
  demonstrate Add friend, request, accept, and later invitation flows.

When `npm start` runs with this PostgreSQL `.env`, the terminal should also show
the currency refresh scheduler status:

```text
Currency refresh scheduler: enabled; refresh on start: enabled; interval: 24 hours.
Exchange rates refreshed: stored ... USD rates from open.er-api.com; fetched at ...
```

Without `DATABASE_URL`, the scheduler is disabled because exchange rates cannot
be persisted:

```text
Currency refresh scheduler: disabled because DATABASE_URL is not set or the database layer is not connected.
```

You can test persistence by:

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

## Linux DB Host

The Linux script also uses Docker. By default it binds PostgreSQL to `127.0.0.1:5432`, which is meant for SSH tunneling instead of exposing Postgres publicly.

On the Linux server:

```bash
./database/start_db_linux.sh
```

From your Mac, create a tunnel:

```bash
ssh -L 5433:localhost:5432 your_user@YOUR_SERVER_IP
```

Then set your Mac `.env` to:

```text
DATABASE_URL=postgresql://tripsplit_user:12345678@localhost:5433/tripsplit
JWT_SECRET=tripsplit-local-db-secret
PORT=3000
CORS_ORIGIN=http://localhost:3000
```

Run the app on your Mac:

```bash
npm start
```

The Linux server does not need to pull the repo frequently if it only hosts PostgreSQL. It only needs schema/data changes applied when the database schema changes.

To stop the Linux DB container while keeping data:

```bash
./database/end_db_linux.sh
```

To remove the Linux container and delete DB data:

```bash
PURGE_TRIPSPLIT_DB=1 ./database/end_db_linux.sh
```

## Notes

- `.env` and `.tripsplit-postgres-data/` are intentionally ignored by git.
- The default local password is for development only.
- If you expose PostgreSQL beyond `127.0.0.1`, use a strong password and firewall the port to trusted IP addresses only.
