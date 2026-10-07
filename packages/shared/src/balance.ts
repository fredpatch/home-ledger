import { parseDate } from "./dates.js";
import { DomainError } from "./errors.js";
import { parseAmount } from "./money.js";
import type { OperationStatus } from "./operation-class.js";
import type { Id } from "./operation-rules.js";

export interface BalanceOperation {
  readonly date: string;
  readonly status: OperationStatus;
  readonly amount: number;
  readonly sourceAccountId?: Id | null;
  readonly destAccountId?: Id | null;
  readonly deletedAt?: string | null;
}

export interface TheoreticalBalanceInput {
  readonly accountId: Id;
  readonly openingBalance: number;
  /** Operations dated before this day are ignored (cutoff on the operation date, not its budget month). */
  readonly openingDate: string;
  /** Inclusive upper bound on the operation date. */
  readonly asOf?: string;
  readonly operations: readonly BalanceOperation[];
}

/**
 * docs/spec.md §Modèle de données: opening balance + inflows − outflows, all classes,
 * validated and non-deleted operations only. Destination account +amount, source account −amount.
 */
export function computeTheoreticalBalance(input: TheoreticalBalanceInput): number {
  if (!Number.isSafeInteger(input.openingBalance)) {
    throw new DomainError("invalid_opening_balance");
  }
  const openingDate = parseDate(input.openingDate);
  const asOf = input.asOf === undefined ? undefined : parseDate(input.asOf);

  let balance = input.openingBalance;
  for (const operation of input.operations) {
    if (operation.status !== "validated" || operation.deletedAt) {
      continue;
    }
    const date = parseDate(operation.date);
    if (date < openingDate || (asOf !== undefined && date > asOf)) {
      continue;
    }
    const amount = parseAmount(operation.amount);
    if (operation.destAccountId === input.accountId) {
      balance += amount;
    }
    if (operation.sourceAccountId === input.accountId) {
      balance -= amount;
    }
  }
  return balance;
}
