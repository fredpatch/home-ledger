import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { ApiErrorBody, AppSettings } from "@suivi/shared";
import { startApi, type ApiHarness } from "./helpers.js";

async function withApi(t: TestContext): Promise<ApiHarness> {
  const api = await startApi();
  t.after(() => api.close());
  return api;
}

function storedHash(api: ApiHarness): string {
  return (api.testDb.sqlite.prepare(`SELECT value FROM settings WHERE key = 'auth_password_hash'`).get() as { value: string }).value;
}

test("settings: GET returns the allowlisted values only, never auth_*", async (t) => {
  const api = await withApi(t);
  const response = await api.call<AppSettings>("GET", "/api/settings");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    savingsTargetPercent: 30,
    budgetRolloverDay: 25,
    cashTolerance: 5000,
    potBudgetTolerance: 0,
    openingDate: "2026-10-01",
  });
  const text = JSON.stringify(response.body);
  assert.equal(text.includes("auth"), false);
  assert.equal(text.includes(storedHash(api)), false);
});

test("settings: PATCH updates allowlisted values within bounds", async (t) => {
  const api = await withApi(t);
  const response = await api.call<AppSettings>("PATCH", "/api/settings", { budgetRolloverDay: 28, cashTolerance: 0, potBudgetTolerance: 10000 });
  assert.equal(response.status, 200);
  assert.equal(response.body.budgetRolloverDay, 28);
  assert.equal(response.body.cashTolerance, 0);
  assert.equal(response.body.potBudgetTolerance, 10000);
  assert.equal((await api.call<AppSettings>("GET", "/api/settings")).body.budgetRolloverDay, 28);
});

test("settings: invalid, read-only and auth keys are rejected and nothing is written", async (t) => {
  const api = await withApi(t);
  const hash = storedHash(api);
  const response = await api.call<ApiErrorBody>("PATCH", "/api/settings", {
    budgetRolloverDay: 29,
    cashTolerance: -1,
    openingDate: "2026-11-01",
    auth_password_hash: "replaced",
    potBudgetTolerance: 1000,
  });
  assert.equal(response.status, 422);
  assert.deepEqual(response.body, {
    error: "validation_failed",
    issues: [
      { field: "budgetRolloverDay", code: "out_of_range" },
      { field: "cashTolerance", code: "out_of_range" },
      { field: "openingDate", code: "read_only" },
      { field: "auth_password_hash", code: "unknown_field" },
    ],
  });
  assert.equal(storedHash(api), hash);
  assert.deepEqual((await api.call<AppSettings>("GET", "/api/settings")).body.potBudgetTolerance, 0);
});

test("settings: PATCH needs the CSRF token", async (t) => {
  const api = await withApi(t);
  const response = await api.call<ApiErrorBody>("PATCH", "/api/settings", { cashTolerance: 1 }, { csrf: false });
  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { error: "csrf_invalid" });
  assert.equal((await api.call<AppSettings>("GET", "/api/settings")).body.cashTolerance, 5000);
});
