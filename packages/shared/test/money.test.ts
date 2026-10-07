import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError, isValidAmount, parseAmount } from "../src/index.js";

test("amount: positive safe integers are valid", () => {
  assert.equal(parseAmount(1), 1);
  assert.equal(parseAmount(1_023_000), 1_023_000);
  assert.equal(parseAmount(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
});

test("amount: zero, negatives, decimals, non-finite and unsafe values are rejected", () => {
  for (const value of [0, -1, 12.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, "100", null, undefined]) {
    assert.equal(isValidAmount(value), false, String(value));
    assert.throws(
      () => parseAmount(value),
      (error: unknown) => error instanceof DomainError && error.code === "invalid_amount",
    );
  }
});
