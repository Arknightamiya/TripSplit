import { getDatabase } from "../db/pool.js";
import {
  DEFAULT_CURRENCY_CODE,
  SUPPORTED_CURRENCIES,
  normalizeCurrencyCode
} from "../utils/currency.js";

export function isCurrencyRepositoryEnabled() {
  return getDatabase().enabled;
}

export async function listCurrencyRecords() {
  const result = await getDatabase().query(
    `
      SELECT code, name, symbol, decimal_places
      FROM currencies
      WHERE is_supported = TRUE
      ORDER BY code ASC
    `
  );

  return result.rows.map(mapCurrencyRow);
}

export async function upsertSupportedCurrencyRecords() {
  const database = getDatabase();

  await database.transaction(async (client) => {
    for (const currency of SUPPORTED_CURRENCIES) {
      await client.query(
        `
          INSERT INTO currencies (code, name, symbol, decimal_places)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            symbol = EXCLUDED.symbol,
            decimal_places = EXCLUDED.decimal_places,
            is_supported = TRUE
        `,
        [currency.code, currency.name, currency.symbol, currency.decimalPlaces]
      );
    }
  });
}

export async function upsertExchangeRateRecords({
  baseCurrencyCode = DEFAULT_CURRENCY_CODE,
  provider,
  fetchedAt,
  rates
}) {
  const baseCode = normalizeCurrencyCode(baseCurrencyCode);
  const database = getDatabase();

  await database.transaction(async (client) => {
    for (const [quoteCurrencyCode, rate] of Object.entries(rates)) {
      await client.query(
        `
          INSERT INTO currency_exchange_rates (
            base_currency_code,
            quote_currency_code,
            rate,
            provider,
            fetched_at
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (base_currency_code, quote_currency_code)
          DO UPDATE SET
            rate = EXCLUDED.rate,
            provider = EXCLUDED.provider,
            fetched_at = EXCLUDED.fetched_at
        `,
        [
          baseCode,
          normalizeCurrencyCode(quoteCurrencyCode),
          Number(rate),
          provider,
          fetchedAt
        ]
      );
    }
  });
}

//NEW EXCHANGE RATE ADDITION: using USD as base map/old data
export async function getLatestExchangeRateMap(baseCurrencyCode = DEFAULT_CURRENCY_CODE) {
  const baseCode = normalizeCurrencyCode(baseCurrencyCode);
  const result = await getDatabase().query(
    `
      SELECT quote_currency_code, rate
      FROM currency_exchange_rates
      WHERE base_currency_code = $1
    `,
    [baseCode]
  );

  return Object.fromEntries(
    result.rows.map((row) => [String(row.quote_currency_code).trim(), Number(row.rate)])
  );
}

export async function getLatestExchangeRateRecords(baseCurrencyCode = DEFAULT_CURRENCY_CODE) {
  const baseCode = normalizeCurrencyCode(baseCurrencyCode);
  const result = await getDatabase().query(
    `
      SELECT quote_currency_code, rate, provider, fetched_at
      FROM currency_exchange_rates
      WHERE base_currency_code = $1
    `,
    [baseCode]
  );

  return result.rows.map((row) => ({
    quoteCurrencyCode: String(row.quote_currency_code).trim(),
    rate: Number(row.rate),
    provider: row.provider,
    fetchedAt: formatTimestamp(row.fetched_at)
  }));
}

function formatTimestamp(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return new Date(value).toISOString();
  }

  return value.toISOString();
}

function mapCurrencyRow(row) {
  return {
    code: String(row.code).trim(),
    name: row.name,
    symbol: row.symbol,
    decimalPlaces: Number(row.decimal_places)
  };
}
