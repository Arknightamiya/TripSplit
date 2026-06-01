import {
  getLatestExchangeRateMap,
  getLatestExchangeRateRecords,
  isCurrencyRepositoryEnabled,
  listCurrencyRecords,
  upsertExchangeRateRecords,
  upsertSupportedCurrencyRecords
} from "../repositories/currencies.js";
import {
  DEFAULT_CURRENCY_CODE,
  FALLBACK_EXCHANGE_RATES,
  SUPPORTED_CURRENCIES,
  convertCurrencyAmount as convertAmountWithRates,
  normalizeCurrencyCode,
  requireSupportedCurrencyCode
} from "../utils/currency.js";
import { badRequest } from "../utils/errors.js";

const DEFAULT_EXCHANGE_RATE_URL = "https://open.er-api.com/v6/latest/USD";

export async function listSupportedCurrencies() {
  if (!isCurrencyRepositoryEnabled()) {
    return {
      baseCurrencyCode: DEFAULT_CURRENCY_CODE,
      fetchedAt: null,
      rates: FALLBACK_EXCHANGE_RATES,
      currencies: SUPPORTED_CURRENCIES.map((currency) => ({
        ...currency,
        rate: FALLBACK_EXCHANGE_RATES[currency.code] ?? null,
        provider: "fallback",
        fetchedAt: null
      }))
    };
  }

  await upsertSupportedCurrencyRecords();
  const ratesByCode = {
    ...FALLBACK_EXCHANGE_RATES,
    ...(await getLatestExchangeRateMap(DEFAULT_CURRENCY_CODE))
  };
  ratesByCode[DEFAULT_CURRENCY_CODE] = ratesByCode[DEFAULT_CURRENCY_CODE] || 1;
  const rateRecords = await getLatestExchangeRateRecords(DEFAULT_CURRENCY_CODE);
  const rateMetaByCode = Object.fromEntries(
    rateRecords.map((record) => [record.quoteCurrencyCode, record])
  );
  const currencies = await listCurrencyRecords();

  return {
    baseCurrencyCode: DEFAULT_CURRENCY_CODE,
    fetchedAt: rateRecords[0]?.fetchedAt || null,
    rates: ratesByCode,
    currencies: currencies.map((currency) => ({
      ...currency,
      rate: ratesByCode[currency.code] ?? null,
      provider: rateMetaByCode[currency.code]?.provider || null,
      fetchedAt: rateMetaByCode[currency.code]?.fetchedAt || null
    }))
  };
}

export async function refreshExchangeRates({
  url = DEFAULT_EXCHANGE_RATE_URL,
  provider = "open.er-api.com"
} = {}) {
  if (!isCurrencyRepositoryEnabled()) {
    throw badRequest("DATABASE_URL is required before refreshing exchange rates");
  }

  await upsertSupportedCurrencyRecords();

  const response = await fetch(url);
  if (!response.ok) {
    throw badRequest(`Exchange-rate fetch failed with status ${response.status}`);
  }

  const payload = await response.json();
  const baseCurrencyCode = requireSupportedCurrencyCode(
    payload.base_code || payload.base || DEFAULT_CURRENCY_CODE
  );
  const fetchedAt = payload.time_last_update_unix
    ? new Date(payload.time_last_update_unix * 1000)
    : new Date();
  const rates = filterSupportedRates(payload.rates || {}, baseCurrencyCode);

  await upsertExchangeRateRecords({
    baseCurrencyCode,
    provider,
    fetchedAt,
    rates
  });

  return {
    baseCurrencyCode,
    provider,
    fetchedAt: fetchedAt.toISOString(),
    rates
  };
}

export async function convertCurrencyAmount({
  amount,
  fromCurrencyCode,
  toCurrencyCode
}) {
  if (!isCurrencyRepositoryEnabled()) {
    throw badRequest("DATABASE_URL is required before converting currencies");
  }

  const fromCode = requireSupportedCurrencyCode(fromCurrencyCode);
  const toCode = requireSupportedCurrencyCode(toCurrencyCode);
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    throw badRequest("Amount must be a valid number");
  }

  const ratesByCode = await getLatestExchangeRateMap(DEFAULT_CURRENCY_CODE);
  ratesByCode[DEFAULT_CURRENCY_CODE] = ratesByCode[DEFAULT_CURRENCY_CODE] || 1;

  return {
    amount: numericAmount,
    fromCurrencyCode: fromCode,
    toCurrencyCode: toCode,
    convertedAmount: convertAmountWithRates(numericAmount, fromCode, toCode, ratesByCode)
  };
}

function filterSupportedRates(inputRates, baseCurrencyCode) {
  const rates = {};

  for (const currency of SUPPORTED_CURRENCIES) {
    const code = normalizeCurrencyCode(currency.code);
    const rate = code === baseCurrencyCode ? 1 : Number(inputRates[code]);
    if (rate > 0) {
      rates[code] = rate;
    }
  }

  return rates;
}
