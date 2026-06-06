import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../server/app.js";
import { connectDatabase } from "../server/db/pool.js";
import {
  authHeaders,
  createRequest,
  registerUser
} from "./helpers/api.js";

const shouldRunDatabaseSmoke =
  process.env.TRIPSPLIT_DATABASE_SMOKE === "1" && Boolean(process.env.DATABASE_URL);
const databaseSmokeSkipReason = process.env.DATABASE_URL
  ? "Set TRIPSPLIT_DATABASE_SMOKE=1 to run the PostgreSQL smoke test."
  : "Set DATABASE_URL to run the PostgreSQL smoke test.";

test(
  "PostgreSQL-backed API smoke covers user, trip, budget, expense, and balances",
  {
    skip: shouldRunDatabaseSmoke
      ? false
      : databaseSmokeSkipReason
  },
  async () => {
    const database = connectDatabase();
    assert.equal(database.enabled, true);

    const app = createApp();
    const request = createRequest(app);
    const suffix = `${Date.now()}-${process.pid}`;
    const emails = [
      `db-smoke-owner-${suffix}@example.com`,
      `db-smoke-member-${suffix}@example.com`
    ];

    try {
      const organizer = await registerUser(request, {
        name: `DbSmokeOwner${suffix}`,
        email: emails[0],
        password: "Db-Smoke_123"
      });
      const member = await registerUser(request, {
        name: `DbSmokeMember${suffix}`,
        email: emails[1],
        password: "Db-Smoke_123"
      });

      const tripResponse = await request("/api/trips", {
        method: "POST",
        headers: authHeaders(organizer.token),
        body: {
          name: "Database Smoke Trip",
          destination: "PostgreSQL",
          startDate: "2026-07-01",
          endDate: "2026-07-03"
        }
      });
      const tripId = tripResponse.body.trip.id;

      const participantResponse = await request(`/api/trips/${tripId}/participants`, {
        method: "POST",
        headers: authHeaders(organizer.token),
        body: {
          userId: member.user.id
        }
      });
      const budgetResponse = await request(`/api/trips/${tripId}/budget`, {
        method: "POST",
        headers: authHeaders(organizer.token),
        body: {
          mode: "total",
          totalBudget: 200
        }
      });
      const startResponse = await request(`/api/trips/${tripId}/start`, {
        method: "POST",
        headers: authHeaders(organizer.token)
      });
      const expenseResponse = await request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: authHeaders(organizer.token),
        body: {
          title: "Shared Dinner",
          amount: 80,
          category: "food",
          expenseType: "personal_advance",
          payerId: organizer.user.id,
          includedParticipantIds: [organizer.user.id, member.user.id]
        }
      });
      const balancesResponse = await request(`/api/trips/${tripId}/balances`, {
        headers: authHeaders(member.token)
      });

      assert.equal(tripResponse.status, 201);
      assert.equal(participantResponse.status, 200);
      assert.equal(budgetResponse.status, 200);
      assert.equal(startResponse.status, 200);
      assert.equal(expenseResponse.status, 201);
      assert.equal(expenseResponse.body.expense.expenseShares[0].shareAmount, 40);
      assert.equal(balancesResponse.status, 200);
      assert.deepEqual(
        balancesResponse.body.balances.map(({ participantId, actualPaid, fairShare, netBalance }) => ({
          participantId,
          actualPaid,
          fairShare,
          netBalance
        })),
        [
          {
            participantId: organizer.user.id,
            actualPaid: 80,
            fairShare: 40,
            netBalance: 40
          },
          {
            participantId: member.user.id,
            actualPaid: 0,
            fairShare: 40,
            netBalance: -40
          }
        ]
      );
    } finally {
      await database.query("DELETE FROM pending_registrations WHERE email = ANY($1)", [emails])
        .catch(() => {});
      await database.query("DELETE FROM users WHERE email = ANY($1)", [emails])
        .catch(() => {});
      await database.close();
    }
  }
);
