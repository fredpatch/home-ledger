import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACCOUNT_SEEDS,
  BUDGET_SEEDS,
  CATEGORY_SEEDS,
  ENVELOPE_SEEDS,
} from "../src/db/seed/reference-data.js";

test("seed: six accounts in the approved order", () => {
  assert.deepEqual(
    ACCOUNT_SEEDS.map((a) => a.name),
    ["BGFI courant", "BGFI mobile", "Espèces", "BGFI épargne", "UGB épargne", "Carte prépayée"],
  );
});

test("seed: only BGFI épargne funds projects", () => {
  assert.deepEqual(
    ACCOUNT_SEEDS.filter((a) => a.fundsProjects).map((a) => a.name),
    ["BGFI épargne"],
  );
});

test("seed: rolls_over is true for exactly Salaire, Épargne and Chargement du pot", () => {
  assert.deepEqual(
    CATEGORY_SEEDS.filter((c) => c.rollsOver)
      .map((c) => c.name)
      .sort(),
    ["Chargement du pot", "Salaire", "Épargne"].sort(),
  );
});

test("seed: 8 envelopes and 29 categories with unique names", () => {
  assert.equal(ENVELOPE_SEEDS.length, 8);
  assert.equal(CATEGORY_SEEDS.length, 29);
  assert.equal(new Set(CATEGORY_SEEDS.map((c) => c.name)).size, 29);
  assert.equal(new Set(ENVELOPE_SEEDS.map((e) => e.name)).size, 8);
});

test("seed: only expense categories have an existing envelope", () => {
  const envelopeNames = new Set(ENVELOPE_SEEDS.map((e) => e.name));
  for (const category of CATEGORY_SEEDS) {
    if (category.class === "expense") {
      assert.ok(category.envelope !== null && envelopeNames.has(category.envelope), category.name);
    } else {
      assert.equal(category.envelope, null, category.name);
    }
  }
});

test("seed: October 2026 budgets are 13 expense categories totalling 540 500 (435 500 pot)", () => {
  assert.equal(BUDGET_SEEDS.length, 13);
  const byName = new Map(CATEGORY_SEEDS.map((c) => [c.name, c]));
  const envelopeSource = new Map(ENVELOPE_SEEDS.map((e) => [e.name, e.source]));
  let total = 0;
  let pot = 0;
  for (const budget of BUDGET_SEEDS) {
    const category = byName.get(budget.category);
    assert.ok(category && category.class === "expense", budget.category);
    total += budget.amount;
    if (envelopeSource.get(category.envelope as string) === "pot") {
      pot += budget.amount;
    }
  }
  assert.equal(total, 540500);
  assert.equal(pot, 435500);
});
