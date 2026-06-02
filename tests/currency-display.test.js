import assert from "node:assert/strict";
import { test } from "node:test";
import { bindCurrencySelectLabels, currencyOptionLabel, currencyOptionsHtml } from "../web/currency.js";

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

test("currency select collapses to compact labels after confirming a choice", async () => {
  const listeners = new Map();
  const classes = new Set();
  const options = [
    option("USD", "USD · 1 USD = 1.0000 USD"),
    option("CNY", "CNY · 1 USD = 6.7726 CNY")
  ];
  const select = {
    dataset: {},
    options,
    selectedIndex: 0,
    matches: (selector) => selector === "[data-currency-select]",
    addEventListener: (name, handler) => listeners.set(name, handler),
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
      contains: (name) => classes.has(name)
    }
  };

  bindCurrencySelectLabels(select);
  listeners.get("pointerdown")();
  assert.equal(options[0].textContent, "USD · 1 USD = 1.0000 USD");
  assert.equal(options[1].textContent, "CNY · 1 USD = 6.7726 CNY");
  listeners.get("click")();
  assert.equal(options[0].textContent, "USD · 1 USD = 1.0000 USD");
  assert.equal(options[1].textContent, "CNY · 1 USD = 6.7726 CNY");

  select.selectedIndex = 1;
  listeners.get("change")();
  assert.equal(options[1].textContent, "CNY");
  assert.equal(select.classList.contains("is-showing-options"), false);

  await waitForDeferredCollapse();
  assert.equal(options[0].textContent, "USD");
  assert.equal(options[1].textContent, "CNY");

  listeners.get("pointerdown")();
  select.dataset.currencyExpandedAt = String(Date.now() - 200);
  listeners.get("click")();
  assert.equal(options[1].textContent, "CNY");
  assert.equal(select.classList.contains("is-showing-options"), false);
});

function option(code, fullLabel) {
  return {
    value: code,
    textContent: code,
    dataset: {
      currencyCode: code,
      fullLabel
    }
  };
}

function waitForDeferredCollapse() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
