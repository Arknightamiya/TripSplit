import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase } from "./db/pool.js";
import { startCurrencyRefreshScheduler } from "./services/currencyRefreshScheduler.js";
import { seedStore } from "./services/seed.js";

const port = Number(process.env.PORT || 3000);

const database = connectDatabase();
await seedStore();
const app = createApp();
const currencyRefreshScheduler = startCurrencyRefreshScheduler({ database });

const server = app.listen(port, () => {
  const dbMode = database.enabled ? "connected" : "noop";
  console.log(`TripSplit running at http://localhost:${port}`);
  console.log(`Database layer: ${dbMode}`);
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function shutdown() {
  currencyRefreshScheduler.stop();
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}
