import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ROLLOVER_DAY, DomainError, budgetMonthAfterEdit, budgetMonthFor } from "../src/index.js";

test("R3: default rollover day is 25", () => {
  assert.equal(DEFAULT_ROLLOVER_DAY, 25);
});

test("R3: salary dated 2026-09-29 belongs to October", () => {
  assert.equal(budgetMonthFor({ date: "2026-09-29", rollsOver: true }), "2026-10");
});

test("R3: day 24 stays, days 25 and 31 roll over", () => {
  assert.equal(budgetMonthFor({ date: "2026-10-24", rollsOver: true }), "2026-10");
  assert.equal(budgetMonthFor({ date: "2026-10-25", rollsOver: true }), "2026-11");
  assert.equal(budgetMonthFor({ date: "2026-10-31", rollsOver: true }), "2026-11");
});

test("R3: operations that do not roll over keep their own month", () => {
  assert.equal(budgetMonthFor({ date: "2026-09-29", rollsOver: false }), "2026-09");
  assert.equal(budgetMonthFor({ date: "2026-09-25", rollsOver: false }), "2026-09");
});

test("R3: December rollover changes the year", () => {
  assert.equal(budgetMonthFor({ date: "2026-12-29", rollsOver: true }), "2027-01");
});

test("R3: early-month operations never roll over", () => {
  assert.equal(budgetMonthFor({ date: "2026-10-01", rollsOver: true }), "2026-10");
});

test("R3: custom rollover day", () => {
  assert.equal(budgetMonthFor({ date: "2026-10-27", rollsOver: true, rolloverDay: 28 }), "2026-10");
  assert.equal(budgetMonthFor({ date: "2026-10-28", rollsOver: true, rolloverDay: 28 }), "2026-11");
  assert.equal(budgetMonthFor({ date: "2026-10-01", rollsOver: true, rolloverDay: 1 }), "2026-11");
  assert.equal(budgetMonthFor({ date: "2026-02-28", rollsOver: true, rolloverDay: 28 }), "2026-03");
});

test("R3: invalid rollover day or date is rejected", () => {
  for (const rolloverDay of [0, 29, 31, 32, 25.5, Number.NaN]) {
    assert.throws(
      () => budgetMonthFor({ date: "2026-10-10", rollsOver: true, rolloverDay }),
      (error: unknown) => error instanceof DomainError && error.code === "invalid_rollover_day",
    );
  }
  assert.throws(
    () => budgetMonthFor({ date: "2026-02-30", rollsOver: true }),
    (error: unknown) => error instanceof DomainError && error.code === "invalid_date",
  );
});

test("R3 on edit (Q9): a computed month follows the new date", () => {
  const previous = { date: "2026-10-20", rollsOver: true, budgetMonth: "2026-10" };
  assert.equal(budgetMonthAfterEdit({ previous, next: { date: "2026-10-29", rollsOver: true }, requested: undefined }), "2026-11");
  assert.equal(budgetMonthAfterEdit({ previous, next: { date: "2026-10-29", rollsOver: false }, requested: undefined }), "2026-10");
});

test("R3 on edit (Q9): a manual override is kept unless replaced or cleared", () => {
  const previous = { date: "2026-10-20", rollsOver: false, budgetMonth: "2026-09" };
  const next = { date: "2026-10-21", rollsOver: false };
  assert.equal(budgetMonthAfterEdit({ previous, next, requested: undefined }), "2026-09");
  assert.equal(budgetMonthAfterEdit({ previous, next, requested: "2026-12" }), "2026-12");
  assert.equal(budgetMonthAfterEdit({ previous, next, requested: null }), "2026-10");
});

test("R3 on edit (Q9): the configured rollover day applies to both sides", () => {
  const previous = { date: "2026-10-20", rollsOver: true, budgetMonth: "2026-11" };
  assert.equal(
    budgetMonthAfterEdit({ previous, next: { date: "2026-10-19", rollsOver: true }, requested: undefined, rolloverDay: 20 }),
    "2026-10",
  );
});
