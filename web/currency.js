export const DEFAULT_CURRENCY_CODE = "USD";

export const DEFAULT_CURRENCY_INFO = {
  baseCurrencyCode: DEFAULT_CURRENCY_CODE,
  fetchedAt: null,
  rates: { [DEFAULT_CURRENCY_CODE]: 1 },
  currencies: [
    { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, rate: 1 },
    { code: "CAD", name: "Canadian Dollar", symbol: "CA$", decimalPlaces: 2, rate: null },
    { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalPlaces: 2, rate: null },
    { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalPlaces: 0, rate: null },
    { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimalPlaces: 2, rate: null },
    { code: "GBP", name: "British Pound", symbol: "£", decimalPlaces: 2, rate: null },
    { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2, rate: null },
    { code: "MXN", name: "Mexican Peso", symbol: "MX$", decimalPlaces: 2, rate: null },
    { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimalPlaces: 2, rate: null },
    { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimalPlaces: 2, rate: null },
    { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2, rate: null },
    { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimalPlaces: 2, rate: null },
    { code: "KRW", name: "South Korean Won", symbol: "₩", decimalPlaces: 0, rate: null },
    { code: "INR", name: "Indian Rupee", symbol: "₹", decimalPlaces: 2, rate: null },
    { code: "THB", name: "Thai Baht", symbol: "฿", decimalPlaces: 2, rate: null },
    { code: "BRL", name: "Brazilian Real", symbol: "R$", decimalPlaces: 2, rate: null },
    { code: "ZAR", name: "South African Rand", symbol: "R", decimalPlaces: 2, rate: null }
  ]
};

export const FALLBACK_EXCHANGE_RATES = {
  USD: 1,
  CAD: 1.37,
  AUD: 1.52,
  JPY: 157,
  CNY: 7.24,
  GBP: 0.79,
  EUR: 0.92,
  MXN: 17.0,
  CHF: 0.9,
  NZD: 1.65,
  SGD: 1.35,
  HKD: 7.82,
  KRW: 1375,
  INR: 83.5,
  THB: 36.7,
  BRL: 5.2,
  ZAR: 18.4
};

export const FALLBACK_CURRENCY_INFO = {
  ...DEFAULT_CURRENCY_INFO,
  rates: FALLBACK_EXCHANGE_RATES,
  currencies: DEFAULT_CURRENCY_INFO.currencies.map((currency) => ({
    ...currency,
    rate: FALLBACK_EXCHANGE_RATES[currency.code] ?? currency.rate
  }))
};

export function normalizeCurrencyInfo(currencyInfo) {
  const info = currencyInfo || FALLBACK_CURRENCY_INFO;
  const rates = {
    ...FALLBACK_EXCHANGE_RATES,
    ...(info.rates || {})
  };
  const currencies = Array.isArray(info.currencies) && info.currencies.length
    ? info.currencies
    : FALLBACK_CURRENCY_INFO.currencies;

  return {
    baseCurrencyCode: info.baseCurrencyCode || DEFAULT_CURRENCY_CODE,
    fetchedAt: info.fetchedAt || null,
    rates,
    currencies: currencies.map((currency) => ({
      ...currency,
      code: normalizeCurrencyCode(currency.code),
      rate: rates[normalizeCurrencyCode(currency.code)] ?? currency.rate ?? null
    }))
  };
}

export function normalizeCurrencyCode(value) {
  return String(value || DEFAULT_CURRENCY_CODE).trim().toUpperCase() || DEFAULT_CURRENCY_CODE;
}

export function formatMoney(value, currencyCode = DEFAULT_CURRENCY_CODE, currencyInfo) {
  const info = normalizeCurrencyInfo(currencyInfo);
  const code = normalizeCurrencyCode(currencyCode);
  const currency = info.currencies.find((entry) => entry.code === code);
  const decimals = Number.isInteger(currency?.decimalPlaces) ? currency.decimalPlaces : 2;
  const symbol = currency?.symbol || code;
  const amount = Number(value || 0).toFixed(decimals);

  return symbol.length <= 2 ? `${symbol}${amount}` : `${amount} ${code}`;
}

export function convertMoney(value, fromCurrencyCode, toCurrencyCode, currencyInfo) {
  const info = normalizeCurrencyInfo(currencyInfo);
  const fromCode = normalizeCurrencyCode(fromCurrencyCode);
  const toCode = normalizeCurrencyCode(toCurrencyCode);
  const fromRate = Number(info.rates[fromCode]);
  const toRate = Number(info.rates[toCode]);

  if (!(fromRate > 0) || !(toRate > 0)) {
    return null;
  }

  return roundMoney((Number(value || 0) / fromRate) * toRate);
}

export function currencyOptionsHtml(currencyInfo, { selectedCode = DEFAULT_CURRENCY_CODE } = {}) {
  const info = normalizeCurrencyInfo(currencyInfo);
  const selected = normalizeCurrencyCode(selectedCode);

  return info.currencies
    .map((currency) => {
      const code = normalizeCurrencyCode(currency.code);
      const selectedAttr = code === selected ? "selected" : "";
      return `<option value="${escapeHtml(code)}" ${selectedAttr}>${escapeHtml(currencyOptionLabel(currency, info))}</option>`;
    })
    .join("");
}

export function currencyOptionLabel(currency, currencyInfo) {
  const info = normalizeCurrencyInfo(currencyInfo);
  const code = normalizeCurrencyCode(currency.code);
  const rate = Number(currency.rate ?? info.rates[code]);
  const fetched = currency.fetchedAt || info.fetchedAt;

  if (!(rate > 0)) {
    return `${code} · rate not fetched`;
  }

  const fetchLabel = fetched ? ` · ${formatFetchDate(fetched)}` : "";
  return `${code} · 1 ${info.baseCurrencyCode} = ${rate.toFixed(4)} ${code}${fetchLabel}`;
}

function formatFetchDate(value) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  } catch {
    return "last fetch";
  }
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}
