import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DomainError,
  dayOf,
  isValidBudgetMonth,
  isValidDate,
  monthOf,
  nextMonth,
  parseBudgetMonth,
  parseDate,
} from "../src/index.js";

test("date: valid calendar dates", () => {
  assert.equal(parseDate("2026-10-01"), "2026-10-01");
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2000-02-29"), true);
});

test("date: invalid calendar dates and formats are rejected", () => {
  for (const value of [
    "2026-02-29",
    "1900-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "2026-10-32",
    "2026-10-00",
    "2026-1-01",
    "26-10-01",
    "2026-10-01T00:00:00Z",
    " 2026-10-01",
    "",
    null,
    20261001,
  ]) {
    assert.equal(isValidDate(value), false, String(value));
  }
  assert.throws(
    () => parseDate("2026-02-30"),
    (error: unknown) => error instanceof DomainError && error.code === "invalid_date",
  );
});

test("date: month and day are read from the string, never shifted", () => {
  assert.equal(monthOf("2026-09-30"), "2026-09");
  assert.equal(dayOf("2026-09-30"), 30);
  assert.equal(dayOf("2026-10-01"), 1);
});

test("budget month: format validation", () => {
  assert.equal(parseBudgetMonth("2026-10"), "2026-10");
  for (const value of ["2026-13", "2026-00", "2026-1", "2026-10-01", "", null]) {
    assert.equal(isValidBudgetMonth(value), false, String(value));
  }
  assert.throws(
    () => parseBudgetMonth("2026-13"),
    (error: unknown) => error instanceof DomainError && error.code === "invalid_budget_month",
  );
});

test("budget month: nextMonth handles the year change", () => {
  assert.equal(nextMonth("2026-09"), "2026-10");
  assert.equal(nextMonth("2026-12"), "2027-01");
});
