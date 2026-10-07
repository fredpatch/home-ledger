import { DomainError } from "./errors.js";

/** Amounts are positive safe integers in XAF; direction comes from class + accounts. */
export function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseAmount(value: unknown): number {
  if (!isValidAmount(value)) {
    throw new DomainError("invalid_amount");
  }
  return value;
}
