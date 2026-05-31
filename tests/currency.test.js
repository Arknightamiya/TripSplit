import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CURRENCY_CODE,
  SUPPORTED_CURRENCIES,
  convertCurrencyAmount,
  normalizeCurrencyCode
} from "../server/utils/currency.js";

test("supported currency list stays travel-focused and readable", () => {
  assert.equal(DEFAULT_CURRENCY_CODE, "USD");
  assert.ok(SUPPORTED_CURRENCIES.length < 20);
  assert.deepEqual(
    SUPPORTED_CURRENCIES.map((currency) => currency.code),
    [
      "USD",
      "CAD",
      "AUD",
      "JPY",
      "CNY",
      "GBP",
      "EUR",
      "MXN",
      "CHF",
      "NZD",
      "SGD",
      "HKD",
      "KRW",
      "INR",
      "THB",
      "BRL",
      "ZAR"
    ]
  );
});

test("normalizeCurrencyCode defaults blank values to USD", () => {
  assert.equal(normalizeCurrencyCode(null), "USD");
  assert.equal(normalizeCurrencyCode(""), "USD");
  assert.equal(normalizeCurrencyCode(" eur "), "EUR");
});

test("convertCurrencyAmount converts through USD-based rates", () => {
  const ratesByCode = {
    USD: 1,
    EUR: 0.8,
    JPY: 160
  };

  assert.equal(convertCurrencyAmount(10, "USD", "EUR", ratesByCode), 8);
  assert.equal(convertCurrencyAmount(800, "JPY", "USD", ratesByCode), 5);
  assert.equal(convertCurrencyAmount(10, "EUR", "JPY", ratesByCode), 2000);
});
