import assert from "node:assert/strict";
import { test } from "node:test";
import { currencyOptionLabel, currencyOptionsHtml } from "../web/currency.js";

test("currencyOptionLabel shows a clear fetched date when rates update", () => {
  assert.equal(
    currencyOptionLabel(
      {
        code: "CNY",
        rate: 6.7726,
        fetchedAt: "2026-06-01T12:00:00.000Z"
      },
      {
        baseCurrencyCode: "USD",
        rates: { USD: 1, CNY: 6.7726 },
        currencies: []
      }
    ),
    "CNY · 1 USD = 6.7726 CNY · updated Jun 1, 2026"
  );
});

test("currencyOptionsHtml keeps the closed select label compact", () => {
  const html = currencyOptionsHtml(
    {
      baseCurrencyCode: "USD",
      fetchedAt: "2026-06-01T12:00:00.000Z",
      rates: { USD: 1, CNY: 6.7726 },
      currencies: [
        { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimalPlaces: 2, rate: 6.7726 }
      ]
    },
    { selectedCode: "CNY" }
  );

  assert.match(html, />CNY<\/option>/);
  assert.match(html, /data-full-label="CNY · 1 USD = 6.7726 CNY · updated Jun 1, 2026"/);
});
