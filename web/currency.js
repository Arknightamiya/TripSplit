export const DEFAULT_CURRENCY_CODE = "USD";

export const FALLBACK_CURRENCY_INFO = {
  baseCurrencyCode: DEFAULT_CURRENCY_CODE,
  fetchedAt: null,
  rates: { USD: 1 },
  currencies: [
    { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, rate: 1 }
  ]
};

export function normalizeCurrencyInfo(currencyInfo) {
  const info = currencyInfo || FALLBACK_CURRENCY_INFO;
  const rates = {
    USD: 1,
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

export function rateHint(currencyCode, currencyInfo) {
  const info = normalizeCurrencyInfo(currencyInfo);
  const code = normalizeCurrencyCode(currencyCode);
  const currency = info.currencies.find((entry) => entry.code === code);
  return currency ? currencyOptionLabel(currency, info) : `${code} · rate not fetched`;
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
