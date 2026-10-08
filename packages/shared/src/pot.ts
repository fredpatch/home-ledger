// docs/decisions.md 2026-10-08 "Budget envelopes vs pot": warn, never block; tolerance from settings.
// P1.5 plan Q3: the pot of a budget month is the sum of its "Chargement du pot" operations.
export const POT_CATEGORY_NAME = "Chargement du pot";

export interface PotWarning {
  readonly code: "budget_exceeds_pot";
  readonly budgetMonth: string;
  /** Sum of the month's budgets whose envelope source is "pot". */
  readonly potBudgets: number;
  readonly pot: number;
  readonly tolerance: number;
}

export interface PotCheckInput {
  readonly budgetMonth: string;
  readonly potBudgets: number;
  readonly pot: number;
  readonly tolerance: number;
}

/** Returns a warning when the pot-funded budgets exceed the pot by more than the tolerance. */
export function checkPotBudget(input: PotCheckInput): PotWarning | null {
  if (input.potBudgets <= input.pot + input.tolerance) {
    return null;
  }
  return { code: "budget_exceeds_pot", ...input };
}
