import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError, parseSettingsPatch, parseStoredSettings, SETTING_DB_KEYS } from "../src/index.js";

test("settings patch: valid values within bounds", () => {
  assert.deepEqual(parseSettingsPatch({ budgetRolloverDay: 28, cashTolerance: 0, potBudgetTolerance: 10000, savingsTargetPercent: 100 }), {
    ok: true,
    value: { budgetRolloverDay: 28, cashTolerance: 0, potBudgetTolerance: 10000, savingsTargetPercent: 100 },
  });
  assert.deepEqual(parseSettingsPatch({}), { ok: true, value: {} });
});

test("settings patch: bounds, types, read-only and unknown names", () => {
  const result = parseSettingsPatch({
    budgetRolloverDay: 29,
    cashTolerance: -1,
    savingsTargetPercent: 30.5,
    potBudgetTolerance: "0",
    openingDate: "2026-11-01",
    auth_password_hash: "x",
  });
  assert.ok(!result.ok);
  assert.deepEqual(result.issues, [
    { field: "budgetRolloverDay", code: "out_of_range" },
    { field: "cashTolerance", code: "out_of_range" },
    { field: "savingsTargetPercent", code: "invalid" },
    { field: "potBudgetTolerance", code: "invalid" },
    { field: "openingDate", code: "read_only" },
    { field: "auth_password_hash", code: "unknown_field" },
  ]);
  assert.deepEqual(parseSettingsPatch({ budgetRolloverDay: 0 }), { ok: false, issues: [{ field: "budgetRolloverDay", code: "out_of_range" }] });
  assert.deepEqual(parseSettingsPatch(null), { ok: false, issues: [{ field: "body", code: "invalid" }] });
});

test("stored settings: seeded values, defaults for missing keys, no auth key", () => {
  const seeded = new Map([
    ["savings_target_percent", "30"],
    ["budget_rollover_day", "25"],
    ["cash_tolerance", "5000"],
    ["opening_date", "2026-10-01"],
    ["auth_password_hash", "$argon2id$secret"],
  ]);
  const settings = parseStoredSettings(seeded);
  assert.deepEqual(settings, {
    savingsTargetPercent: 30,
    budgetRolloverDay: 25,
    cashTolerance: 5000,
    potBudgetTolerance: 0,
    openingDate: "2026-10-01",
  });
  assert.equal(JSON.stringify(settings).includes("argon2"), false);
  assert.equal(parseStoredSettings(new Map()).openingDate, null);
  assert.equal(Object.values(SETTING_DB_KEYS).some((key) => key.startsWith("auth_")), false);
});

test("stored settings: an invalid stored value throws instead of being used", () => {
  for (const [key, value] of [
    ["budget_rollover_day", "31"],
    ["cash_tolerance", "1.5"],
    ["savings_target_percent", "abc"],
    ["opening_date", "2026-02-30"],
  ] as const) {
    assert.throws(() => parseStoredSettings(new Map([[key, value]])), DomainError, key);
  }
});
