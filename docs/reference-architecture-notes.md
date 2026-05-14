# Reference Architecture Notes

Updated: 2026-05-14

This document records architecture patterns reviewed from the prior `BruinDating` project and how they should influence TripSplit. The purpose is not to copy another app or switch stacks. The purpose is to keep TripSplit's starter architecture consistent while five people work in separate branches.

Reference reviewed:

- Repository: `https://github.com/BruinDating/bruindating.git`
- Default branch at review time: `main`
- HEAD at review time: `249df87303859893885695a4116acaa95fc526cc`
- Frontend: Next.js, TypeScript, Mantine, Tailwind
- Backend: Django, Django REST Framework, PostgreSQL, JWT

## What To Borrow

### Clear Frontend/Backend Boundary

BruinDating keeps `frontend/` and `backend/` separate. TripSplit should keep the same boundary concept even while the current scaffold is lightweight:

- UI code belongs in `web/` now and later in a React frontend.
- API/server code belongs in `server/`.
- Cross-cutting names, route builders, constants, and contract values belong in `shared/`.
- Database schema and integration docs belong in `database/` and `docs/`.

### Central API Client

BruinDating uses a frontend service file for backend calls. TripSplit should follow that idea, but keep it smaller and more modular:

- `web/api.js` should be the only place that directly wraps `fetch` in the current scaffold.
- UI/render/form modules should call API helper functions instead of hardcoding endpoint strings.
- Auth header names, token storage keys, and route builders should come from `shared/contracts.js`.
- If the project migrates to React, the same idea should become `src/services/api.js` or `src/services/api.ts`.

### Auth Context And Route Protection Pattern

BruinDating has an `AuthContext`, route protection hook, protected route component, login callback page, and logout button. TripSplit should borrow the pattern, not the exact implementation:

- FE 1 should centralize auth state rather than duplicating localStorage reads in every page.
- Protected pages should check authentication and trip access before rendering private trip data.
- Backend access control remains authoritative. Frontend route protection is only a UI guard.
- JWT token storage key should stay consistent through `shared/contracts.js`.

### Backend Domain Modules

BruinDating splits backend code by domain (`auth_app`, `profiles`, `matching`, `chat`) and gives each domain its own routes, models, serializers, and views. TripSplit should use the same domain-separation idea:

- Auth, trips, participants, budgets, expenses, and balances should stay separated by helper functions or route modules.
- When Express is introduced, prefer files such as `server/routes/auth.js`, `server/routes/trips.js`, `server/routes/expenses.js`, and `server/services/settlement.js`.
- Keep settlement calculation separate from HTTP routing so it can be tested independently.
- Keep PostgreSQL queries behind a database/service layer instead of spreading SQL through UI or route code.

### Response Shape Boundary

BruinDating uses serializers to decide what the frontend receives. TripSplit should enforce that same boundary through API contract and response builders:

- API responses should match `docs/api-contract.md`.
- Backend code should not leak internal database row names when the contract uses frontend-facing names such as `budgetSummary`, `expenseType`, or `expenseShares`.
- If a response shape changes, update `docs/api-contract.md` and `shared/contracts.js` first.

### Shared Theme Discipline

BruinDating has a central theme and layout shell. TripSplit should borrow the discipline:

- Shared colors, spacing, and reusable class names should live in `web/styles.css` now.
- FE 1 and FE 2 should coordinate before changing common layout, typography, buttons, cards, and form styling.
- If React is added later, move shared theme values into one theme module instead of scattering hardcoded styles.

### Environment Configuration

BruinDating uses environment settings for URLs, secrets, database credentials, and frontend/backend origins. TripSplit should keep `.env.example` updated as shared infrastructure evolves:

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`

## What Not To Borrow

- Do not switch TripSplit to Next.js or Django just because BruinDating uses them. TripSplit's agreed target remains React, Express, PostgreSQL, and JWT.
- Do not put every frontend API helper forever in one giant file. `web/api.js` is acceptable for the starter scaffold; React work should split by feature when it grows.
- Do not treat frontend route protection as real security. Backend access control must enforce trip membership and organizer-only actions.
- Do not leave tests empty. TripSplit should keep settlement tests and add API/access-control tests as routes become real.
- Do not copy dating-app domain logic. Matching, chat, profile settings, and Google OAuth are not TripSplit MVP requirements.

## TripSplit Adaptation Rules

Use these rules during pull, merge, and PR review:

- Check whether shared route names, auth headers, token keys, expense constants, or budget constants should be updated in `shared/contracts.js`.
- Check whether endpoint request/response shapes changed and update `docs/api-contract.md`.
- Check whether schema relationships changed and update `database/schema.sql`.
- Check whether UI changes touch shared layout or theme and update `web/styles.css` carefully.
- Check whether new backend behavior needs tests in `tests/`.
- Keep `main` runnable after every merge.

## Current Concrete Changes

Based on this review, TripSplit now has:

- Shared route builders in `shared/contracts.js`.
- A shared auth token storage key in `shared/contracts.js`.
- A small `web/api.js` request wrapper that applies JSON headers and bearer tokens consistently.
- Expanded `.env.example` entries for JWT and frontend/backend origin configuration.
