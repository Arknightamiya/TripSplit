export const DEFAULT_CURRENCY_CODE = "USD";

export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", decimalPlaces: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalPlaces: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalPlaces: 0 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimalPlaces: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimalPlaces: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", decimalPlaces: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimalPlaces: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimalPlaces: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimalPlaces: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", decimalPlaces: 0 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimalPlaces: 2 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimalPlaces: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimalPlaces: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimalPlaces: 2 }
];

export function roundCurrency(value) {
  return Number(value.toFixed(2));
}

export function splitCurrencyEvenly(amount, participantIds) {
  const splitCount = participantIds.length || 1;
  const totalCents = Math.round(roundCurrency(Number(amount)) * 100);
  const baseShareCents = Math.floor(totalCents / splitCount);
  const remainderCents = totalCents % splitCount;

  return participantIds.map((participantId, index) => ({
    participantId,
    shareAmount: centsToCurrency(baseShareCents + (index < remainderCents ? 1 : 0))
  }));
}

function centsToCurrency(cents) {
  return roundCurrency(cents / 100);
}

export function normalizeCurrencyCode(value) {
  return String(value || DEFAULT_CURRENCY_CODE).trim().toUpperCase() || DEFAULT_CURRENCY_CODE;
}

export function isSupportedCurrencyCode(value) {
  const code = normalizeCurrencyCode(value);
  return SUPPORTED_CURRENCIES.some((currency) => currency.code === code);
}

export function requireSupportedCurrencyCode(value) {
  const code = normalizeCurrencyCode(value);
  if (!isSupportedCurrencyCode(code)) {
    throw new Error(`Unsupported currency code: ${code}`);
  }

  return code;
}

export function convertCurrencyAmount(amount, fromCurrencyCode, toCurrencyCode, ratesByCode) {
  const fromCode = normalizeCurrencyCode(fromCurrencyCode);
  const toCode = normalizeCurrencyCode(toCurrencyCode);
  const fromRate = Number(ratesByCode[fromCode]);
  const toRate = Number(ratesByCode[toCode]);

  if (!(fromRate > 0) || !(toRate > 0)) {
    throw new Error(`Missing exchange rate for ${fromCode} or ${toCode}`);
  }

  return roundCurrency((Number(amount) / fromRate) * toRate);
}
