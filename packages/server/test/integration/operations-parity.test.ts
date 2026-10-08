import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { OPERATION_CLASSES, validateOperationShape } from "@suivi/shared";
import { CLASS_CATEGORY, insertOperation, prepare, type Fixture } from "./fixtures.js";
import { createTestDb, sqlError, type TestDatabase } from "./helpers.js";

let t: TestDatabase;
let fx: Fixture;

before(async () => {
  t = await createTestDb();
  fx = prepare(t);
});
after(async () => {
  await t.cleanup();
});

const ACCOUNT_A = 1;
const ACCOUNT_B = 2;

test("parity: DB accepts an operation iff validateOperationShape accepts it (all classes x all link masks)", () => {
  let checked = 0;
  for (const cls of OPERATION_CLASSES) {
    for (let mask = 0; mask < 16; mask += 1) {
      const source = mask & 1 ? ACCOUNT_A : null;
      const dest = mask & 2 ? ACCOUNT_B : null;
      const project = mask & 4 ? fx.projectId : null;
      const loan = mask & 8 ? fx.loanId : null;
      const domainOk =
        validateOperationShape({
          operationClass: cls,
          amount: 1000,
          sourceAccountId: source,
          destAccountId: dest,
          projectId: project,
          loanId: loan,
        }).length === 0;
      const dbError = sqlError(() => insertOperation(t.sqlite, { source, dest, project, loan }, cls));
      assert.equal(dbError === null, domainOk, `${cls} mask ${mask}: db=${dbError}`);
      checked += 1;
    }
  }
  assert.equal(checked, OPERATION_CLASSES.length * 16);
});

test("parity: same source and destination account is rejected for transfer and savings", () => {
  for (const cls of ["transfer", "savings"] as const) {
    const domain = validateOperationShape({
      operationClass: cls,
      amount: 1000,
      sourceAccountId: ACCOUNT_A,
      destAccountId: ACCOUNT_A,
    });
    assert.ok(domain.length > 0);
    assert.notEqual(sqlError(() => insertOperation(t.sqlite, { source: ACCOUNT_A, dest: ACCOUNT_A }, cls)), null);
  }
});

// A numeric string such as "12" is coerced to an integer by SQLite affinity; the API validators reject non-numbers.
test("parity: amounts 0, -5, 1.5, text and above the safe integer are rejected; a positive integer is accepted", () => {
  for (const amount of [0, -5, 1.5, "abc", Number.MAX_SAFE_INTEGER + 2]) {
    assert.notEqual(sqlError(() => insertOperation(t.sqlite, { amount, source: ACCOUNT_A })), null, String(amount));
  }
  assert.equal(sqlError(() => insertOperation(t.sqlite, { amount: 1, source: ACCOUNT_A })), null);
  assert.equal(sqlError(() => insertOperation(t.sqlite, { amount: Number.MAX_SAFE_INTEGER, source: ACCOUNT_A })), null);
});

test("dates: invalid dates and budget months are rejected", () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-1-1", "not-a-date", ""]) {
    assert.notEqual(sqlError(() => insertOperation(t.sqlite, { date, source: ACCOUNT_A })), null, date);
  }
  for (const budgetMonth of ["2026-13", "2026-00", "2026-10-01", "2026-1", ""]) {
    assert.notEqual(sqlError(() => insertOperation(t.sqlite, { budgetMonth, source: ACCOUNT_A })), null, budgetMonth);
  }
  assert.equal(sqlError(() => insertOperation(t.sqlite, { date: "2028-02-29", source: ACCOUNT_A })), null);
});

test("every class has a seeded category used by these tests", () => {
  for (const name of Object.values(CLASS_CATEGORY)) {
    const row = t.sqlite.prepare(`SELECT 1 AS ok FROM categories WHERE name = ?`).get(name);
    assert.ok(row, name);
  }
});
