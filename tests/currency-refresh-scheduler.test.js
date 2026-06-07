import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getRefreshIntervalMs,
  startCurrencyRefreshScheduler
} from "../server/services/currencyRefreshScheduler.js";

test("getRefreshIntervalMs defaults to daily refreshes", () => {
  assert.equal(getRefreshIntervalMs(), 24 * 60 * 60 * 1000);
  assert.equal(getRefreshIntervalMs("2"), 2 * 60 * 60 * 1000);
});

test("startCurrencyRefreshScheduler refreshes on start and on the interval", async () => {
  const timers = [];
  const clearedTimers = [];
  const logs = [];
  let refreshCount = 0;

  const scheduler = startCurrencyRefreshScheduler({
    database: { enabled: true },
    env: { CURRENCY_REFRESH_INTERVAL_HOURS: "2" },
    logger: {
      info(message) {
        logs.push(message);
      },
      warn() {}
    },
    async refresh() {
      refreshCount += 1;
      return {
        baseCurrencyCode: "USD",
        provider: "test-provider",
        fetchedAt: "2026-06-01T12:00:00.000Z",
        rates: { USD: 1, CNY: 6.8 }
      };
    },
    setTimer(callback, intervalMs) {
      const timer = {
        callback,
        intervalMs,
        unrefCalled: false,
        unref() {
          this.unrefCalled = true;
        }
      };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer) {
      clearedTimers.push(timer);
    }
  });

  await Promise.resolve();
  assert.equal(refreshCount, 1);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].intervalMs, 2 * 60 * 60 * 1000);
  assert.equal(timers[0].unrefCalled, true);
  assert.match(logs[0], /Currency refresh scheduler: enabled/);
  assert.match(logs[0], /refresh on start: enabled/);
  assert.match(logs[0], /interval: 2 hours/);
  assert.match(logs[1], /Exchange rates refreshed/);

  await timers[0].callback();
  assert.equal(refreshCount, 2);

  scheduler.stop();
  assert.deepEqual(clearedTimers, [timers[0]]);
});

test("startCurrencyRefreshScheduler can be disabled and ignores missing databases", () => {
  const activeTimers = [];
  const logs = [];
  const logger = {
    info(message) {
      logs.push(message);
    }
  };

  const disabledScheduler = startCurrencyRefreshScheduler({
    database: { enabled: true },
    env: { CURRENCY_REFRESH_ENABLED: "false" },
    logger,
    refresh() {
      throw new Error("should not refresh");
    },
    setTimer(callback, intervalMs) {
      activeTimers.push({ callback, intervalMs });
    }
  });
  const noDatabaseScheduler = startCurrencyRefreshScheduler({
    database: { enabled: false },
    env: {},
    logger,
    refresh() {
      throw new Error("should not refresh");
    },
    setTimer(callback, intervalMs) {
      activeTimers.push({ callback, intervalMs });
    }
  });

  assert.equal(activeTimers.length, 0);
  assert.match(logs[0], /disabled by CURRENCY_REFRESH_ENABLED/);
  assert.match(logs[1], /disabled because DATABASE_URL is not set/);
  disabledScheduler.stop();
  noDatabaseScheduler.stop();
});

test("startCurrencyRefreshScheduler logs refresh failures without throwing", async () => {
  const warnings = [];
  let intervalCallback;

  startCurrencyRefreshScheduler({
    database: { enabled: true },
    env: { CURRENCY_REFRESH_ON_START: "false" },
    logger: {
      info() {},
      warn(message) {
        warnings.push(message);
      }
    },
    async refresh() {
      throw new Error("provider unavailable");
    },
    setTimer(callback) {
      intervalCallback = callback;
      return {};
    },
    clearTimer() {}
  });

  await intervalCallback();
  assert.match(warnings[0], /provider unavailable/);
});
