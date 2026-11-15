import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApiErrorCode, ValidationIssueCode } from "@suivi/shared";
import { apiErrorMessage, issueMessage, issuesByField, potWarningMessage } from "../src/lib/messages.js";

const API_CODES: ApiErrorCode[] = [
  "auth_required",
  "invalid_credentials",
  "too_many_attempts",
  "csrf_invalid",
  "origin_rejected",
  "invalid_request",
  "validation_failed",
  "not_found",
  "conflict",
  "internal_error",
];

test("every API error code has a French message that never shows the raw code", () => {
  for (const code of [...API_CODES, "network" as const]) {
    const message = apiErrorMessage(code);
    assert.ok(message.length > 0, code);
    assert.equal(message.includes(code), false, code);
  }
  assert.equal(apiErrorMessage("invalid_credentials"), "Mot de passe incorrect.");
  assert.equal(apiErrorMessage("too_many_attempts"), "Trop de tentatives. Réessaie dans quelques minutes.");
});

test("issue codes map to French messages; settings bounds add a hint", () => {
  const codes: ValidationIssueCode[] = ["exceeds_remaining", "not_project_funding", "same_account", "class_change_forbidden"];
  for (const code of codes) {
    assert.equal(issueMessage({ field: "amount", code }).includes(code), false, code);
  }
  assert.equal(issueMessage({ field: "budgetRolloverDay", code: "out_of_range" }), "Valeur hors limites. Entre 1 et 28.");
  assert.equal(issueMessage({ field: "cashTolerance", code: "out_of_range" }), "Valeur hors limites. 0 ou plus.");
});

test("issues go under their field; others go to the form banner with the field name", () => {
  const grouped = issuesByField(
    [
      { field: "amount", code: "exceeds_remaining" },
      { field: "accounts", code: "same_account" },
      { field: "projectId", code: "field_forbidden" },
    ],
    ["amount", "date"],
  );
  assert.deepEqual(Object.keys(grouped).sort(), ["amount", "form"]);
  assert.equal(grouped.amount?.length, 1);
  assert.deepEqual(grouped.form, ["Choisis deux comptes différents.", "Projet : Ce champ ne s'applique pas à cette catégorie."]);
});

test("pot warning interpolates the payload values", () => {
  const message = potWarningMessage({ code: "budget_exceeds_pot", budgetMonth: "2026-11", potBudgets: 512345, pot: 300000, tolerance: 0 });
  assert.equal(message, "Les budgets du pot de novembre 2026 (512 345) dépassent le pot du mois (300 000).");
});
