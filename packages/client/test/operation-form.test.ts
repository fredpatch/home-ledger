import assert from "node:assert/strict";
import { test } from "node:test";
import { OPERATION_CLASSES, type OperationDto, type ReferenceCategory, type ReferenceEnvelope } from "@suivi/shared";
import {
  buildCreateRequest,
  buildUpdateRequest,
  derivedLine,
  emptyForm,
  formFromOperation,
  shownFieldNames,
  visibleFields,
  withCategory,
} from "../src/lib/operation-form.js";

const envelopes: ReferenceEnvelope[] = [{ id: 2, name: "Transport et alimentation", source: "pot" }];
const category = (id: number, cls: ReferenceCategory["class"], extra: Partial<ReferenceCategory> = {}): ReferenceCategory => ({
  id,
  name: `cat-${id}`,
  class: cls,
  envelopeId: null,
  rollsOver: false,
  ...extra,
});
const groceries = category(1, "expense", { envelopeId: 2, name: "Courses" });
const salary = category(2, "revenue", { rollsOver: true, name: "Salaire" });
const pot = category(3, "transfer", { rollsOver: true, name: "Chargement du pot" });
const loan = category(4, "loan");
const repayment = category(5, "repayment");
const purchase = category(6, "project");

test("visible fields follow the R2 matrix for every class (no class picker)", () => {
  assert.deepEqual(visibleFields("expense"), {
    sourceAccountId: "required",
    destAccountId: "hidden",
    projectId: "hidden",
    loan: "hidden",
    exactlyOneAccount: false,
  });
  assert.equal(visibleFields("revenue").destAccountId, "required");
  assert.equal(visibleFields("transfer").projectId, "optional");
  assert.equal(visibleFields("project").projectId, "required");
  assert.equal(visibleFields("loan").loan, "person");
  assert.equal(visibleFields("repayment").loan, "select");
  assert.equal(visibleFields("adjustment").exactlyOneAccount, true);
  for (const operationClass of OPERATION_CLASSES) {
    const names = shownFieldNames(operationClass);
    assert.ok(names.includes("amount") && names.includes("categoryId"), operationClass);
  }
  assert.ok(shownFieldNames("loan").includes("loanPerson"));
  assert.equal(shownFieldNames("loan").includes("loanId"), false);
});

test("changing category drops links the new class does not use", () => {
  const form = { ...emptyForm("2026-10-10"), sourceAccountId: 1, destAccountId: 2, projectId: 7, loanPerson: "Ami" };
  const asExpense = withCategory(form, groceries);
  assert.deepEqual([asExpense.sourceAccountId, asExpense.destAccountId, asExpense.projectId, asExpense.loanPerson], [1, null, null, ""]);
  const asTransfer = withCategory(form, pot);
  assert.deepEqual([asTransfer.sourceAccountId, asTransfer.destAccountId, asTransfer.projectId], [1, 2, 7]);
  assert.equal(withCategory(form, loan).loanPerson, "Ami");
});

test("derived line: class · envelope · budget month, with R3 rollover and override", () => {
  const form = emptyForm("2026-10-29");
  assert.deepEqual(derivedLine(form, undefined, envelopes, 25), { text: "Choisis une catégorie.", budgetMonth: null });
  assert.equal(derivedLine(form, groceries, envelopes, 25).text, "Dépense · Transport et alimentation · octobre 2026");
  assert.equal(derivedLine(form, salary, envelopes, 25).text, "Revenu · novembre 2026");
  assert.equal(derivedLine(form, pot, envelopes, 25).text, "Transfert · neutre · novembre 2026");
  assert.equal(derivedLine({ ...emptyForm("2026-10-24") }, pot, envelopes, 25).budgetMonth, "2026-10");
  assert.equal(derivedLine({ ...emptyForm("2026-10-21") }, pot, envelopes, 20).budgetMonth, "2026-11");
  assert.equal(derivedLine({ ...form, budgetMonthOverride: "2026-10" }, salary, envelopes, 25).budgetMonth, "2026-10");
});

test("derived line on edit predicts the server rule (Q9): a manual month is kept unless cleared", () => {
  const previous = { date: "2026-10-20", rollsOver: false, budgetMonth: "2026-09" };
  const form = emptyForm("2026-10-21");
  assert.equal(derivedLine(form, groceries, envelopes, 25, previous).budgetMonth, "2026-09");
  assert.equal(derivedLine({ ...form, clearOverride: true }, groceries, envelopes, 25, previous).budgetMonth, "2026-10");
  const computed = { date: "2026-10-20", rollsOver: true, budgetMonth: "2026-10" };
  assert.equal(derivedLine(emptyForm("2026-10-29"), salary, envelopes, 25, computed).budgetMonth, "2026-11");
});

test("create request: amount and category required locally; class never sent", () => {
  const blank = buildCreateRequest(emptyForm("2026-10-10"), groceries);
  assert.deepEqual(blank.ok ? [] : blank.issues.map((i) => i.field), ["amount", "categoryId"]);
  const form = { ...withCategory(emptyForm("2026-10-10"), groceries), amountText: "10 000", sourceAccountId: 2, label: "  Marché " };
  const result = buildCreateRequest(form, groceries);
  assert.ok(result.ok);
  assert.deepEqual(result.value, {
    date: "2026-10-10",
    amount: 10000,
    categoryId: 1,
    label: "Marché",
    note: null,
    sourceAccountId: 2,
    destAccountId: null,
    projectId: null,
  });
  assert.equal("class" in result.value, false);
  assert.equal("loanPerson" in result.value, false);
});

test("create request: loan sends the person, repayment the loan, override the month", () => {
  const lend = buildCreateRequest({ ...withCategory(emptyForm("2026-10-05"), loan), amountText: "150000", sourceAccountId: 3, loanPerson: " Ami " }, loan);
  assert.ok(lend.ok);
  assert.equal(lend.value.loanPerson, "Ami");
  assert.equal("loanId" in lend.value, false);
  const repay = buildCreateRequest({ ...withCategory(emptyForm("2026-10-20"), repayment), amountText: "1000", destAccountId: 1, loanId: 9 }, repayment);
  assert.ok(repay.ok);
  assert.equal(repay.value.loanId, 9);
  const override = buildCreateRequest({ ...withCategory(emptyForm("2026-10-29"), salary), amountText: "1", destAccountId: 1, budgetMonthOverride: "2026-10" }, salary);
  assert.ok(override.ok);
  assert.equal(override.value.budgetMonth, "2026-10");
  const project = buildCreateRequest({ ...withCategory(emptyForm("2026-10-29"), purchase), amountText: "5", sourceAccountId: 4, projectId: 2 }, purchase);
  assert.ok(project.ok);
  assert.equal(project.value.projectId, 2);
});

test("update request: lock token, Mois automatique, loanId never sent for a loan", () => {
  const operation: OperationDto = {
    id: 10,
    date: "2026-10-05",
    budgetMonth: "2026-10",
    label: null,
    amount: 150000,
    categoryId: 4,
    class: "loan",
    sourceAccountId: 3,
    destAccountId: null,
    projectId: null,
    client: null,
    usage: null,
    loanId: 77,
    status: "validated",
    note: null,
    createdAt: "2026-10-05T08:00:00.000Z",
    updatedAt: "2026-10-05T08:00:00.123Z",
  };
  const form = formFromOperation(operation, "");
  const result = buildUpdateRequest({ ...form, amountText: "160000" }, loan, operation);
  assert.ok(result.ok);
  assert.equal(result.value.expectedUpdatedAt, "2026-10-05T08:00:00.123Z");
  assert.equal(result.value.amount, 160000);
  assert.equal("loanId" in result.value, false);
  assert.equal("loanPerson" in result.value, false);
  assert.equal("budgetMonth" in result.value, false);
  const cleared = buildUpdateRequest({ ...form, clearOverride: true }, loan, operation);
  assert.ok(cleared.ok);
  assert.equal(cleared.value.budgetMonth, null);
  const renamed = buildUpdateRequest({ ...form, loanPerson: "Ami B" }, loan, operation);
  assert.ok(renamed.ok);
  assert.equal(renamed.value.loanPerson, "Ami B");
});
