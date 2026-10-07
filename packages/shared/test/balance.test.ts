import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError, computeTheoreticalBalance } from "../src/index.js";
import type { BalanceOperation } from "../src/index.js";

const OPENING_DATE = "2026-10-01";

function op(fields: Partial<BalanceOperation> & Pick<BalanceOperation, "amount">): BalanceOperation {
  return { date: "2026-10-05", status: "validated", ...fields };
}

function balance(accountId: number, operations: BalanceOperation[], extra: { asOf?: string; openingBalance?: number } = {}) {
  return computeTheoreticalBalance({
    accountId,
    openingBalance: extra.openingBalance ?? 100_000,
    openingDate: OPENING_DATE,
    operations,
    ...(extra.asOf === undefined ? {} : { asOf: extra.asOf }),
  });
}

test("balance: no operations returns the opening balance", () => {
  assert.equal(balance(1, []), 100_000);
});

test("balance: destination adds, source subtracts", () => {
  const operations = [
    op({ amount: 50_000, destAccountId: 1 }),
    op({ amount: 20_000, sourceAccountId: 1 }),
  ];
  assert.equal(balance(1, operations), 130_000);
});

test("balance: a transfer moves money between accounts and nets to zero overall", () => {
  const operations = [op({ amount: 40_000, sourceAccountId: 1, destAccountId: 2 })];
  const first = balance(1, operations, { openingBalance: 0 });
  const second = balance(2, operations, { openingBalance: 0 });
  assert.equal(first, -40_000);
  assert.equal(second, 40_000);
  assert.equal(first + second, 0);
});

test("balance: drafts and soft-deleted operations are excluded", () => {
  const operations = [
    op({ amount: 10_000, destAccountId: 1, status: "draft" }),
    op({ amount: 20_000, destAccountId: 1, deletedAt: "2026-10-06" }),
    op({ amount: 5_000, destAccountId: 1, deletedAt: null }),
  ];
  assert.equal(balance(1, operations), 105_000);
});

test("balance: cutoff uses the operation date, not its budget month", () => {
  const salary = op({ amount: 1_000_000, destAccountId: 1, date: "2026-09-29" });
  assert.equal(balance(1, [salary]), 100_000);
});

test("balance: an operation dated on the opening date is included", () => {
  assert.equal(balance(1, [op({ amount: 7_000, destAccountId: 1, date: OPENING_DATE })]), 107_000);
  assert.equal(balance(1, [op({ amount: 7_000, destAccountId: 1, date: "2026-09-30" })]), 100_000);
});

test("balance: asOf is inclusive", () => {
  const operations = [
    op({ amount: 1_000, destAccountId: 1, date: "2026-10-10" }),
    op({ amount: 2_000, destAccountId: 1, date: "2026-10-11" }),
  ];
  assert.equal(balance(1, operations, { asOf: "2026-10-10" }), 101_000);
  assert.equal(balance(1, operations, { asOf: "2026-10-11" }), 103_000);
  assert.equal(balance(1, operations, { asOf: "2026-10-09" }), 100_000);
});

test("balance: other accounts' operations are ignored", () => {
  assert.equal(balance(1, [op({ amount: 9_000, destAccountId: 2 }), op({ amount: 3_000, sourceAccountId: 3 })]), 100_000);
});

test("balance: the result may be negative", () => {
  assert.equal(balance(1, [op({ amount: 150_000, sourceAccountId: 1 })]), -50_000);
  assert.equal(balance(1, [], { openingBalance: -2_000 }), -2_000);
});

test("balance: invalid amounts, dates and opening balance are rejected", () => {
  const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
  assert.throws(() => balance(1, [op({ amount: 0, destAccountId: 1 })]), code("invalid_amount"));
  assert.throws(() => balance(1, [op({ amount: 10.5, destAccountId: 1 })]), code("invalid_amount"));
  assert.throws(() => balance(1, [op({ amount: 10, destAccountId: 1, date: "2026-02-30" })]), code("invalid_date"));
  assert.throws(() => balance(1, [], { openingBalance: 1.5 }), code("invalid_opening_balance"));
  assert.throws(() => balance(1, [], { asOf: "bad" }), code("invalid_date"));
});
