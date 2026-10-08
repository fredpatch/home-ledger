import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { seedReference } from "../../src/db/seed/seed-reference.js";
import { createTestDb, type TestDatabase } from "./helpers.js";

let t: TestDatabase;

before(async () => {
  t = await createTestDb();
});
after(async () => {
  await t.cleanup();
});

const count = (table: string) => (t.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

test("seed inserts the approved reference data, then a second run changes nothing", () => {
  const first = seedReference(t.db);
  assert.deepEqual(first, { accounts: 6, envelopes: 8, categories: 29, budgets: 13, settings: 5 });
  const second = seedReference(t.db);
  assert.deepEqual(second, { accounts: 0, envelopes: 0, categories: 0, budgets: 0, settings: 0 });
  assert.equal(count("accounts"), 6);
  assert.equal(count("categories"), 29);
  assert.equal(count("budgets"), 13);
});

test("seeded rolls_over is true for exactly Salaire, Épargne and Chargement du pot", () => {
  const rows = t.sqlite.prepare(`SELECT name FROM categories WHERE rolls_over = 1 ORDER BY name`).all() as { name: string }[];
  assert.deepEqual(rows.map((r) => r.name).sort(), ["Chargement du pot", "Salaire", "Épargne"].sort());
});

test("seeded funds_projects is true only for BGFI épargne; October budgets total 540 500", () => {
  const rows = t.sqlite.prepare(`SELECT name FROM accounts WHERE funds_projects = 1`).all() as { name: string }[];
  assert.deepEqual(rows.map((r) => r.name), ["BGFI épargne"]);
  const total = t.sqlite.prepare(`SELECT SUM(amount) AS s FROM budgets WHERE budget_month = '2026-10'`).get() as { s: number };
  assert.equal(total.s, 540500);
});

test("seed does not overwrite an edited row", () => {
  t.sqlite.prepare(`UPDATE budgets SET amount = 1 WHERE category_id = (SELECT id FROM categories WHERE name = 'Courses')`).run();
  seedReference(t.db);
  const row = t.sqlite
    .prepare(`SELECT amount FROM budgets WHERE category_id = (SELECT id FROM categories WHERE name = 'Courses')`)
    .get() as { amount: number };
  assert.equal(row.amount, 1);
});
