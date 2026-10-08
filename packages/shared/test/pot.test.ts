import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPotBudget, POT_CATEGORY_NAME } from "../src/index.js";

test("pot: the pot category is Chargement du pot", () => {
  assert.equal(POT_CATEGORY_NAME, "Chargement du pot");
});

test("pot: no warning at or below pot + tolerance", () => {
  assert.equal(checkPotBudget({ budgetMonth: "2026-10", potBudgets: 400000, pot: 400000, tolerance: 0 }), null);
  assert.equal(checkPotBudget({ budgetMonth: "2026-10", potBudgets: 405000, pot: 400000, tolerance: 5000 }), null);
  assert.equal(checkPotBudget({ budgetMonth: "2026-10", potBudgets: 0, pot: 0, tolerance: 0 }), null);
});

test("pot: warning above pot + tolerance (October seed: 435 500 vs 400 000)", () => {
  assert.deepEqual(checkPotBudget({ budgetMonth: "2026-10", potBudgets: 435500, pot: 400000, tolerance: 0 }), {
    code: "budget_exceeds_pot",
    budgetMonth: "2026-10",
    potBudgets: 435500,
    pot: 400000,
    tolerance: 0,
  });
  assert.notEqual(checkPotBudget({ budgetMonth: "2026-10", potBudgets: 405001, pot: 400000, tolerance: 5000 }), null);
  // No pot loaded yet: any pot budget warns.
  assert.notEqual(checkPotBudget({ budgetMonth: "2026-11", potBudgets: 1, pot: 0, tolerance: 0 }), null);
});
