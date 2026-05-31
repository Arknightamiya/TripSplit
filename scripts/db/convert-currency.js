import "dotenv/config";
import { connectDatabase } from "../../server/db/pool.js";
import { convertCurrencyAmount } from "../../server/services/currencies.js";

const [, , rawAmount, fromCurrencyCode, toCurrencyCode] = process.argv;

if (!rawAmount || !fromCurrencyCode || !toCurrencyCode) {
  console.error("Usage: node scripts/db/convert-currency.js <amount> <from> <to>");
  process.exit(1);
}

const database = connectDatabase();

if (!database.enabled) {
  console.error("DATABASE_URL is required before converting currencies.");
  process.exit(1);
}

try {
  const result = await convertCurrencyAmount({
    amount: Number(rawAmount),
    fromCurrencyCode,
    toCurrencyCode
  });

  console.log(
    `${result.amount} ${result.fromCurrencyCode} = ${result.convertedAmount} ${result.toCurrencyCode}`
  );
} finally {
  await database.close();
}
