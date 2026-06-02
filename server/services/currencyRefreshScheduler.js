import { refreshExchangeRates } from "./currencies.js";

const DEFAULT_REFRESH_INTERVAL_HOURS = 24;
const HOURS_TO_MS = 60 * 60 * 1000;

export function startCurrencyRefreshScheduler({
  database,
  env = process.env,
  logger = console,
  refresh = refreshExchangeRates,
  setTimer = setInterval,
  clearTimer = clearInterval
} = {}) {
  if (!database?.enabled || !isEnabled(env.CURRENCY_REFRESH_ENABLED, true)) {
    return createStoppedScheduler();
  }

  const intervalMs = getRefreshIntervalMs(env.CURRENCY_REFRESH_INTERVAL_HOURS);
  let isStopped = false;
  let isRefreshing = false;

  const refreshOnce = async () => {
    if (isStopped || isRefreshing) {
      return null;
    }

    isRefreshing = true;
    try {
      const result = await refresh();
      logger.info?.(
        `Exchange rates refreshed: stored ${Object.keys(result.rates).length} ${result.baseCurrencyCode} rates from ${result.provider}; fetched at ${result.fetchedAt}.`
      );
      return result;
    } catch (error) {
      logger.warn?.(`Exchange rate auto-refresh failed: ${error.message || error}`);
      return null;
    } finally {
      isRefreshing = false;
    }
  };

  if (isEnabled(env.CURRENCY_REFRESH_ON_START, true)) {
    void refreshOnce();
  }

  const timer = setTimer(refreshOnce, intervalMs);
  timer?.unref?.();

  return {
    refreshNow: refreshOnce,
    stop() {
      isStopped = true;
      clearTimer(timer);
    }
  };
}

export function getRefreshIntervalMs(value) {
  const hours = Number(value);
  if (Number.isFinite(hours) && hours > 0) {
    return hours * HOURS_TO_MS;
  }

  return DEFAULT_REFRESH_INTERVAL_HOURS * HOURS_TO_MS;
}

function isEnabled(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

function createStoppedScheduler() {
  return {
    async refreshNow() {
      return null;
    },
    stop() {}
  };
}
