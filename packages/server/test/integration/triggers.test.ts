import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { insertOperation, prepare } from "./fixtures.js";
import { createTestDb, sqlError, type TestDatabase } from "./helpers.js";

let t: TestDatabase;

before(async () => {
  t = await createTestDb();
  prepare(t);
});
after(async () => {
  await t.cleanup();
});

const cat = (name: string) => (t.sqlite.prepare(`SELECT id FROM categories WHERE name = ?`).get(name) as { id: number }).id;

test("trigger: operation class must equal its category class on INSERT", () => {
  assert.notEqual(sqlError(() => insertOperation(t.sqlite, { source: 1, class: "transfer", dest: 2 }, "expense")), null);
});

test("trigger: operation class must equal its category class on UPDATE", () => {
  const { lastInsertRowid } = insertOperation(t.sqlite, { source: 1 });
  assert.notEqual(
    sqlError(() => t.sqlite.prepare(`UPDATE operations SET category_id = ? WHERE id = ?`).run(cat("Salaire"), lastInsertRowid)),
    null,
  );
  assert.equal(
    sqlError(() => t.sqlite.prepare(`UPDATE operations SET category_id = ? WHERE id = ?`).run(cat("Restaurant"), lastInsertRowid)),
    null,
  );
});

test("trigger: operations cannot be hard-deleted (soft delete only)", () => {
  const { lastInsertRowid } = insertOperation(t.sqlite, { source: 1 });
  assert.notEqual(sqlError(() => t.sqlite.prepare(`DELETE FROM operations WHERE id = ?`).run(lastInsertRowid)), null);
  assert.equal(
    sqlError(() => t.sqlite.prepare(`UPDATE operations SET deleted_at = '2026-10-11T00:00:00Z' WHERE id = ?`).run(lastInsertRowid)),
    null,
  );
});

test("trigger: a category class cannot change once operations use it", () => {
  insertOperation(t.sqlite, { source: 1, categoryName: "Courses" });
  assert.notEqual(sqlError(() => t.sqlite.prepare(`UPDATE categories SET class = 'revenue', envelope_id = NULL WHERE name = 'Courses'`).run()), null);
  // An unused category can still change class.
  assert.equal(sqlError(() => t.sqlite.prepare(`UPDATE categories SET class = 'revenue', envelope_id = NULL WHERE name = 'Vente'`).run()), null);
});

test("trigger: change_log is append-only", () => {
  t.sqlite.prepare(`INSERT INTO change_log (table_name, row_id, before_json, after_json) VALUES ('operations', 1, '{}', '{}')`).run();
  assert.notEqual(sqlError(() => t.sqlite.prepare(`UPDATE change_log SET table_name = 'x'`).run()), null);
  assert.notEqual(sqlError(() => t.sqlite.prepare(`DELETE FROM change_log`).run()), null);
});
