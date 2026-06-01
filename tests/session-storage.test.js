import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  clearAuthSession,
  getScopedStorage,
  getSessionStorageKey,
  getStoredAuthToken,
  storeAuthSession
} from "../web/api.js";

beforeEach(() => {
  global.window = {
    location: {
      search: ""
    },
    localStorage: createStorage(),
    sessionStorage: createStorage()
  };
});

test("ordinary windows keep auth in per-window session storage", () => {
  storeAuthSession({
    token: "window-token",
    user: { id: "1", name: "dw#1" }
  });

  assert.equal(getScopedStorage(), window.sessionStorage);
  assert.equal(getStoredAuthToken(), "window-token");
  assert.equal(window.sessionStorage.getItem("tripsplit.authToken"), "window-token");
  assert.equal(window.localStorage.getItem("tripsplit.authToken"), null);

  clearAuthSession();

  assert.equal(window.sessionStorage.getItem("tripsplit.authToken"), null);
});

test("named session URLs keep isolated auth in local storage", () => {
  window.location.search = "?session=dw1";

  storeAuthSession({
    token: "named-token",
    user: { id: "1", name: "dw#1" }
  });

  assert.equal(getScopedStorage(), window.localStorage);
  assert.equal(getSessionStorageKey("tripsplit.authToken"), "tripsplit.authToken.dw1");
  assert.equal(getStoredAuthToken(), "named-token");
  assert.equal(window.localStorage.getItem("tripsplit.authToken.dw1"), "named-token");
  assert.equal(window.sessionStorage.getItem("tripsplit.authToken.dw1"), null);
});

function createStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}
