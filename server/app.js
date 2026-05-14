import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCors } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { createAuthRouter } from "./routes/auth.js";
import { createBalancesRouter } from "./routes/balances.js";
import { createExpensesRouter } from "./routes/expenses.js";
import { createTripsRouter } from "./routes/trips.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.resolve(__dirname, "..");

export function createApp({ rootDir = defaultRootDir } = {}) {
  const app = express();

  app.use(applyCors);
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "TripSplit API" });
  });

  app.use("/api/auth", createAuthRouter());
  app.use("/api/trips/:tripId/expenses", createExpensesRouter());
  app.use("/api/trips/:tripId/balances", createBalancesRouter());
  app.use("/api/trips", createTripsRouter());

  app.get("/", (_req, res) => {
    res.sendFile(path.join(rootDir, "web", "index.html"));
  });

  app.use(express.static(rootDir));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
