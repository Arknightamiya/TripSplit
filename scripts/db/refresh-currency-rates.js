import "dotenv/config";
import { connectDatabase } from "../../server/db/pool.js";
import { refreshExchangeRates } from "../../server/services/currencies.js";

const database = connectDatabase();

if (!database.enabled) {
  console.error("DATABASE_URL is required before refreshing exchange rates.");
  process.exit(1);
}

try {
  const result = await refreshExchangeRates();
  console.log(`Stored ${Object.keys(result.rates).length} ${result.baseCurrencyCode} exchange rates.`);
  console.log(`Provider: ${result.provider}`);
  console.log(`Fetched at: ${result.fetchedAt}`);
} finally {
  await database.close();
}
