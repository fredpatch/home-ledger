import assert from "node:assert/strict";
import { test } from "node:test";
import { OPERATION_CLASSES, validateOperationShape } from "../src/index.js";
import type { OperationIssue, OperationShape } from "../src/index.js";

function shape(operationClass: string, fields: Partial<OperationShape> = {}): OperationShape {
  return { operationClass, amount: 1000, ...fields };
}

function issues(operationClass: string, fields: Partial<OperationShape> = {}): OperationIssue[] {
  return validateOperationShape(shape(operationClass, fields));
}

test("R2: one valid combination per class", () => {
  assert.deepEqual(issues("revenue", { destAccountId: 1 }), []);
  assert.deepEqual(issues("expense", { sourceAccountId: 1 }), []);
  assert.deepEqual(issues("transfer", { sourceAccountId: 1, destAccountId: 2 }), []);
  assert.deepEqual(issues("savings", { sourceAccountId: 1, destAccountId: 4 }), []);
  assert.deepEqual(issues("project", { sourceAccountId: 6, projectId: 1 }), []);
  assert.deepEqual(issues("loan", { sourceAccountId: 3, loanId: 1 }), []);
  assert.deepEqual(issues("repayment", { destAccountId: 3, loanId: 1 }), []);
  assert.deepEqual(issues("adjustment", { sourceAccountId: 3 }), []);
  assert.deepEqual(issues("adjustment", { destAccountId: 3 }), []);
  assert.equal(OPERATION_CLASSES.length, 8);
});

test("R2: missing required fields are reported per field", () => {
  assert.deepEqual(issues("revenue"), [{ code: "field_required", field: "destAccountId" }]);
  assert.deepEqual(issues("expense"), [{ code: "field_required", field: "sourceAccountId" }]);
  assert.deepEqual(issues("transfer", { sourceAccountId: 1 }), [
    { code: "field_required", field: "destAccountId" },
  ]);
  assert.deepEqual(issues("savings", { destAccountId: 4 }), [
    { code: "field_required", field: "sourceAccountId" },
  ]);
  assert.deepEqual(issues("project", { sourceAccountId: 6 }), [
    { code: "field_required", field: "projectId" },
  ]);
  assert.deepEqual(issues("repayment", { destAccountId: 3 }), [
    { code: "field_required", field: "loanId" },
  ]);
});

test("R10: a loan without pret_id is rejected, with it is valid", () => {
  assert.deepEqual(issues("loan", { sourceAccountId: 3 }), [{ code: "field_required", field: "loanId" }]);
  assert.deepEqual(issues("loan", { sourceAccountId: 3, loanId: 7 }), []);
});

test("R7: a transfer may link a project; optional", () => {
  assert.deepEqual(issues("transfer", { sourceAccountId: 4, destAccountId: 6, projectId: 1 }), []);
  assert.deepEqual(issues("transfer", { sourceAccountId: 4, destAccountId: 6 }), []);
});

test("R2: fields foreign to the class are rejected", () => {
  assert.deepEqual(issues("expense", { sourceAccountId: 1, destAccountId: 2 }), [
    { code: "field_forbidden", field: "destAccountId" },
  ]);
  assert.deepEqual(issues("revenue", { sourceAccountId: 1, destAccountId: 2 }), [
    { code: "field_forbidden", field: "sourceAccountId" },
  ]);
  assert.deepEqual(issues("savings", { sourceAccountId: 1, destAccountId: 4, projectId: 1 }), [
    { code: "field_forbidden", field: "projectId" },
  ]);
  assert.deepEqual(issues("transfer", { sourceAccountId: 1, destAccountId: 2, loanId: 1 }), [
    { code: "field_forbidden", field: "loanId" },
  ]);
  assert.deepEqual(issues("project", { sourceAccountId: 6, projectId: 1, destAccountId: 2 }), [
    { code: "field_forbidden", field: "destAccountId" },
  ]);
  assert.deepEqual(issues("loan", { sourceAccountId: 3, loanId: 1, projectId: 1 }), [
    { code: "field_forbidden", field: "projectId" },
  ]);
  assert.deepEqual(issues("repayment", { destAccountId: 3, loanId: 1, sourceAccountId: 2 }), [
    { code: "field_forbidden", field: "sourceAccountId" },
  ]);
  assert.deepEqual(issues("expense", { sourceAccountId: 1, projectId: 1 }), [
    { code: "field_forbidden", field: "projectId" },
  ]);
});

test("R2: loan with a destination, revenue with a loan link, repayment with a project are rejected", () => {
  assert.deepEqual(issues("loan", { sourceAccountId: 3, loanId: 1, destAccountId: 2 }), [
    { code: "field_forbidden", field: "destAccountId" },
  ]);
  assert.deepEqual(issues("revenue", { destAccountId: 1, loanId: 1 }), [
    { code: "field_forbidden", field: "loanId" },
  ]);
  assert.deepEqual(issues("repayment", { destAccountId: 3, loanId: 1, projectId: 1 }), [
    { code: "field_forbidden", field: "projectId" },
  ]);
});

test("R2: transfer and savings need two different accounts", () => {
  assert.deepEqual(issues("transfer", { sourceAccountId: 1, destAccountId: 1 }), [
    { code: "same_account", field: "accounts" },
  ]);
  assert.deepEqual(issues("savings", { sourceAccountId: 2, destAccountId: 2 }), [
    { code: "same_account", field: "accounts" },
  ]);
});

test("R2: adjustment takes exactly one account and no links", () => {
  const oneAccount: OperationIssue = { code: "adjustment_one_account", field: "accounts" };
  assert.deepEqual(issues("adjustment"), [oneAccount]);
  assert.deepEqual(issues("adjustment", { sourceAccountId: 1, destAccountId: 2 }), [oneAccount]);
  assert.deepEqual(issues("adjustment", { sourceAccountId: 1, projectId: 1 }), [
    { code: "field_forbidden", field: "projectId" },
  ]);
  assert.deepEqual(issues("adjustment", { destAccountId: 1, loanId: 1 }), [
    { code: "field_forbidden", field: "loanId" },
  ]);
});

test("R2: unknown class and invalid amounts are reported", () => {
  assert.deepEqual(issues("salary", { destAccountId: 1 }), [
    { code: "invalid_class", field: "operationClass" },
  ]);
  assert.deepEqual(validateOperationShape({ operationClass: "expense", amount: 0, sourceAccountId: 1 }), [
    { code: "invalid_amount", field: "amount" },
  ]);
  assert.deepEqual(validateOperationShape({ operationClass: "expense", amount: 10.5, sourceAccountId: 1 }), [
    { code: "invalid_amount", field: "amount" },
  ]);
});

test("R2: null and undefined ids count as absent", () => {
  assert.deepEqual(issues("expense", { sourceAccountId: 1, destAccountId: null, projectId: null }), []);
  assert.deepEqual(issues("expense", { sourceAccountId: null }), [
    { code: "field_required", field: "sourceAccountId" },
  ]);
});
