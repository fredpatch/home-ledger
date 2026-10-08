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

export interface BudgetMonthEdit {
  readonly previous: { readonly date: string; readonly rollsOver: boolean; readonly budgetMonth: string };
  readonly next: { readonly date: string; readonly rollsOver: boolean };
  /** string = manual override, null = clear the override, undefined = not sent. */
  readonly requested: string | null | undefined;
  readonly rolloverDay?: number;
}

/**
 * docs/spec.md §R3 on edit (P1.5 plan Q9): a stored month that differs from the computed one is a
 * manual override and is kept; otherwise the month follows the new date and category.
 */
export function budgetMonthAfterEdit(edit: BudgetMonthEdit): string {
  if (typeof edit.requested === "string") {
    return edit.requested;
  }
  const computed = budgetMonthFor({ ...edit.next, rolloverDay: edit.rolloverDay });
  if (edit.requested === null) {
    return computed;
  }
  const previousComputed = budgetMonthFor({ ...edit.previous, rolloverDay: edit.rolloverDay });
  return edit.previous.budgetMonth === previousComputed ? computed : edit.previous.budgetMonth;
}
