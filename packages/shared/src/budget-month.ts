import { dayOf, monthOf, nextMonth } from "./dates.js";
import { DomainError } from "./errors.js";

export const DEFAULT_ROLLOVER_DAY = 25;

export interface BudgetMonthInput {
  readonly date: string;
  /** Category property (set in the referential): true for salary, savings and the monthly pot transfer. */
  readonly rollsOver: boolean;
  readonly rolloverDay?: number;
}

/**
 * docs/spec.md §R3 default budget month: the month of the date, or the next month
 * when the operation rolls over and its day is >= the rollover day (default 25).
 * The manual override on an operation stays outside this function.
 */
export function budgetMonthFor(input: BudgetMonthInput): string {
  const rolloverDay = input.rolloverDay ?? DEFAULT_ROLLOVER_DAY;
  if (!Number.isInteger(rolloverDay) || rolloverDay < 1 || rolloverDay > 28) {
    throw new DomainError("invalid_rollover_day");
  }
  const month = monthOf(input.date);
  return input.rollsOver && dayOf(input.date) >= rolloverDay ? nextMonth(month) : month;
}
