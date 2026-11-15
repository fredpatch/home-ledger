import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAmount,
  formatListDate,
  formatMonth,
  parseAmountInput,
  shiftMonth,
  signedAmount,
  todayIso,
} from "../src/lib/format.js";

// Intl fr-FR groups with a narrow no-break space (U+202F).
const NNBSP = " ";

test("amounts: integer XAF with French grouping", () => {
  assert.equal(formatAmount(1023000), `1${NNBSP}023${NNBSP}000`);
  assert.equal(formatAmount(500), "500");
  assert.equal(formatAmount(0), "0");
});

test("amounts: sign and tone follow the class (design brief §3)", () => {
  assert.deepEqual(signedAmount("expense", 12000, false), { text: `−12${NNBSP}000`, tone: "expense" });
  assert.deepEqual(signedAmount("revenue", 150000, true), { text: `+150${NNBSP}000`, tone: "income" });
  assert.deepEqual(signedAmount("repayment", 1000, true), { text: "+1 000", tone: "income" });
  assert.deepEqual(signedAmount("transfer", 400000, true), { text: `400${NNBSP}000`, tone: "neutral" });
  assert.deepEqual(signedAmount("savings", 1000, true).tone, "savings");
  assert.deepEqual(signedAmount("adjustment", 3000, true), { text: `+3${NNBSP}000`, tone: "income" });
  assert.deepEqual(signedAmount("adjustment", 3000, false), { text: `−3${NNBSP}000`, tone: "expense" });
  assert.equal(signedAmount("loan", 1000, false).tone, "expense");
  assert.deepEqual(signedAmount("project", 205000, false), { text: `−205${NNBSP}000`, tone: "savings" });
});

test("dates and months stay strings", () => {
  assert.equal(formatListDate("2026-10-07", 2026), "07/10");
  assert.equal(formatListDate("2025-12-31", 2026), "31/12/2025");
  assert.equal(formatMonth("2026-10"), "octobre 2026");
  assert.equal(formatMonth("2027-02"), "février 2027");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-10", 0), "2026-10");
});

test("today is the local calendar day, not the UTC one", () => {
  // 23:30 local on 7 October, whatever the offset of the machine running the test.
  assert.equal(todayIso(new Date(2026, 9, 7, 23, 30)), "2026-10-07");
  assert.equal(todayIso(new Date(2026, 0, 1, 0, 5)), "2026-01-01");
});

test("amount input: digits only, positive safe integers", () => {
  assert.equal(parseAmountInput("10000"), 10000);
  assert.equal(parseAmountInput(" 10 000 "), 10000);
  assert.equal(parseAmountInput(`1${NNBSP}023${NNBSP}000`), 1023000);
  for (const text of ["", "0", "-5", "1.5", "12,5", "abc", "9007199254740992"]) {
    assert.equal(parseAmountInput(text), null, text);
  }
});
