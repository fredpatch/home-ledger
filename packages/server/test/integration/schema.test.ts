import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { insertOperation, prepare, type Fixture } from "./fixtures.js";
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

const one = <T>(sql: string, ...params: unknown[]) => t.sqlite.prepare(sql).get(...params) as T;

test("foreign keys are enforced", () => {
  assert.notEqual(sqlError(() => insertOperation(t.sqlite, { source: 999 })), null);
  assert.notEqual(
    sqlError(() => t.sqlite.prepare(`INSERT INTO budgets (budget_month, category_id, amount) VALUES ('2026-11', 999, 1)`).run()),
    null,
  );
});

test("UNIQUE on account, envelope and category names", () => {
  assert.notEqual(
    sqlError(() =>
      t.sqlite
        .prepare(`INSERT INTO accounts (name, type, reconciliation_frequency, sort_order) VALUES ('BGFI courant', 'bank', 'weekly', 9)`)
        .run(),
    ),
    null,
  );
  assert.notEqual(sqlError(() => t.sqlite.prepare(`INSERT INTO envelopes (name, source) VALUES ('Maison', 'pot')`).run()), null);
  assert.notEqual(
    sqlError(() => t.sqlite.prepare(`INSERT INTO categories (name, class) VALUES ('Salaire', 'revenue')`).run()),
    null,
  );
});

test("source_ref is UNIQUE but many manual operations may have NULL", () => {
  assert.equal(sqlError(() => insertOperation(t.sqlite, { source: 1, sourceRef: null })), null);
  assert.equal(sqlError(() => insertOperation(t.sqlite, { source: 1, sourceRef: null })), null);
  assert.equal(sqlError(() => insertOperation(t.sqlite, { source: 1, sourceRef: "xlsx-v9.3:row-5" })), null);
  assert.notEqual(sqlError(() => insertOperation(t.sqlite, { source: 1, sourceRef: "xlsx-v9.3:row-5" })), null);
});

test("status defaults to validated and must be draft or validated", () => {
  const { lastInsertRowid } = insertOperation(t.sqlite, { source: 1 });
  assert.equal(one<{ status: string }>(`SELECT status FROM operations WHERE id = ?`, lastInsertRowid).status, "validated");
  assert.notEqual(sqlError(() => insertOperation(t.sqlite, { source: 1, status: "pending" })), null);
});

test("an expense category requires an envelope; other classes forbid one", () => {
  assert.notEqual(sqlError(() => t.sqlite.prepare(`INSERT INTO categories (name, class) VALUES ('X1', 'expense')`).run()), null);
  const envelopeId = one<{ id: number }>(`SELECT id FROM envelopes LIMIT 1`).id;
  assert.notEqual(
    sqlError(() => t.sqlite.prepare(`INSERT INTO categories (name, class, envelope_id) VALUES ('X2', 'revenue', ?)`).run(envelopeId)),
    null,
  );
});

test("budgets: primary key (month, category), amount >= 0 integer, valid month", () => {
  const categoryId = one<{ id: number }>(`SELECT id FROM categories WHERE name = 'Courses'`).id;
  const insert = (month: string, amount: unknown) => () =>
    t.sqlite.prepare(`INSERT INTO budgets (budget_month, category_id, amount) VALUES (?, ?, ?)`).run(month, categoryId, amount);
  assert.equal(sqlError(insert("2026-11", 0)), null);
  assert.notEqual(sqlError(insert("2026-11", 5)), null);
  assert.notEqual(sqlError(insert("2026-12", -1)), null);
  assert.notEqual(sqlError(insert("2026-12", 1.5)), null);
  assert.notEqual(sqlError(insert("2026-13", 1)), null);
});

test("accounts: opening balance must be an integer", () => {
  assert.notEqual(
    sqlError(() =>
      t.sqlite
        .prepare(`INSERT INTO accounts (name, type, opening_balance, reconciliation_frequency, sort_order) VALUES ('Z', 'bank', 1.5, 'weekly', 9)`)
        .run(),
    ),
    null,
  );
});

test("reconciliations: gap must equal actual - theoretical", () => {
  const insert = (gap: number) => () =>
    t.sqlite
      .prepare(`INSERT INTO reconciliations (account_id, date, actual_balance, theoretical_balance, gap) VALUES (1, '2026-10-12', 900, 1000, ?)`)
      .run(gap);
  assert.equal(sqlError(insert(-100)), null);
  assert.notEqual(sqlError(insert(100)), null);
});

test("transfer may link a project; the loan fixture links to a loan operation", () => {
  assert.equal(sqlError(() => insertOperation(t.sqlite, { source: 3, dest: 6, project: fx.projectId }, "transfer")), null);
  assert.equal(sqlError(() => insertOperation(t.sqlite, { source: 1, loan: fx.loanId }, "loan")), null);
});
