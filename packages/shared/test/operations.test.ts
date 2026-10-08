import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OPERATION_LIST_MAX_LIMIT,
  parseCreateOperation,
  parseDeleteOperation,
  parseOperationListQuery,
  parseUpdateOperation,
  type ParseResult,
} from "../src/index.js";

function codes<T>(result: ParseResult<T>): string[] {
  return result.ok ? [] : result.issues.map((issue) => `${issue.field}:${issue.code}`);
}

const minimal = { date: "2026-10-10", amount: 1500, categoryId: 3 };

test("create: minimal and full requests are accepted; text is trimmed, blank text becomes null", () => {
  assert.deepEqual(parseCreateOperation(minimal), { ok: true, value: { ...minimal, budgetMonth: undefined } });
  const full = parseCreateOperation({
    ...minimal,
    budgetMonth: "2026-11",
    label: "  Marché ",
    note: "   ",
    client: null,
    usage: "activity",
    sourceAccountId: 1,
    destAccountId: null,
    projectId: null,
    loanId: null,
    loanPerson: "Ami",
  });
  assert.ok(full.ok);
  assert.equal(full.value.label, "Marché");
  assert.equal(full.value.note, null);
  assert.equal(full.value.budgetMonth, "2026-11");
  assert.equal(full.value.usage, "activity");
});

test("create: class, status, sourceRef and other unknown fields are rejected (R2)", () => {
  const result = parseCreateOperation({ ...minimal, class: "revenue", status: "draft", sourceRef: "x", id: 9 });
  assert.deepEqual(codes(result), ["class:unknown_field", "status:unknown_field", "sourceRef:unknown_field", "id:unknown_field"]);
});

test("create: required fields, amounts, dates and months", () => {
  assert.deepEqual(codes(parseCreateOperation({})), ["date:required", "amount:required", "categoryId:required"]);
  for (const amount of [0, -1, 1.5, "1000", Number.MAX_SAFE_INTEGER + 1, null]) {
    assert.deepEqual(codes(parseCreateOperation({ ...minimal, amount })), ["amount:invalid_amount"], String(amount));
  }
  for (const date of ["2026-02-30", "2026-10-1", "10/10/2026", 20261010]) {
    assert.deepEqual(codes(parseCreateOperation({ ...minimal, date })), ["date:invalid_date"], String(date));
  }
  for (const budgetMonth of ["2026-13", "2026-1", null]) {
    assert.deepEqual(codes(parseCreateOperation({ ...minimal, budgetMonth })), ["budgetMonth:invalid_budget_month"]);
  }
});

test("create: ids, usage and text limits", () => {
  assert.deepEqual(codes(parseCreateOperation({ ...minimal, categoryId: 0 })), ["categoryId:invalid"]);
  assert.deepEqual(codes(parseCreateOperation({ ...minimal, sourceAccountId: "1" })), ["sourceAccountId:invalid"]);
  assert.deepEqual(codes(parseCreateOperation({ ...minimal, usage: "pro" })), ["usage:invalid"]);
  assert.deepEqual(codes(parseCreateOperation({ ...minimal, label: "x".repeat(201) })), ["label:too_long"]);
  assert.deepEqual(codes(parseCreateOperation({ ...minimal, note: 5 })), ["note:invalid"]);
  for (const body of [null, [], "x"]) {
    assert.deepEqual(codes(parseCreateOperation(body)), ["body:invalid"]);
  }
});

test("update: needs expectedUpdatedAt; budgetMonth may be null to clear the override", () => {
  assert.deepEqual(codes(parseUpdateOperation({ amount: 10 })), ["expectedUpdatedAt:required"]);
  assert.deepEqual(codes(parseUpdateOperation({ expectedUpdatedAt: "" })), ["expectedUpdatedAt:invalid"]);
  const cleared = parseUpdateOperation({ expectedUpdatedAt: "t", budgetMonth: null });
  assert.deepEqual(cleared, { ok: true, value: { expectedUpdatedAt: "t", budgetMonth: null } });
  assert.deepEqual(codes(parseUpdateOperation({ expectedUpdatedAt: "t", class: "loan" })), ["class:unknown_field"]);
});

test("delete: only expectedUpdatedAt", () => {
  assert.deepEqual(parseDeleteOperation({ expectedUpdatedAt: "t" }), { ok: true, value: { expectedUpdatedAt: "t" } });
  assert.deepEqual(codes(parseDeleteOperation(undefined)), ["expectedUpdatedAt:required"]);
  assert.deepEqual(codes(parseDeleteOperation({})), ["expectedUpdatedAt:required"]);
  assert.deepEqual(codes(parseDeleteOperation({ expectedUpdatedAt: "t", force: true })), ["force:unknown_field"]);
});

test("list query: defaults, filters and bounds", () => {
  assert.deepEqual(parseOperationListQuery({}), { ok: true, value: { limit: 100, offset: 0 } });
  assert.deepEqual(
    parseOperationListQuery({ month: "2026-10", from: "2026-10-01", to: "2026-10-31", accountId: "2", categoryId: "5", class: "expense", limit: "50", offset: "100" }),
    {
      ok: true,
      value: { month: "2026-10", from: "2026-10-01", to: "2026-10-31", accountId: 2, categoryId: 5, class: "expense", limit: 50, offset: 100 },
    },
  );
  assert.deepEqual(codes(parseOperationListQuery({ limit: String(OPERATION_LIST_MAX_LIMIT + 1) })), ["limit:invalid"]);
  assert.deepEqual(codes(parseOperationListQuery({ limit: "0", offset: "-1", accountId: "x", class: "gift", month: "2026-10-01" })), [
    "limit:invalid",
    "offset:invalid",
    "accountId:invalid",
    "class:invalid",
    "month:invalid",
  ]);
  assert.deepEqual(codes(parseOperationListQuery({ month: ["2026-10", "2026-11"], sort: "date" })), ["month:invalid", "sort:unknown_field"]);
});
