import {
  budgetMonthAfterEdit,
  budgetMonthFor,
  operationFieldRules,
  type CreateOperationRequest,
  type Id,
  type OperationClass,
  type OperationDto,
  type ReferenceCategory,
  type ReferenceEnvelope,
  type UpdateOperationRequest,
  type ValidationIssue,
} from "@suivi/shared";
import { formatMonth, parseAmountInput } from "./format.js";
import { CLASS_LABELS } from "./messages.js";

// Operation form logic (docs/app-flow.md F2/F3): the category decides the class (R2), the class decides
// which fields exist (shared operationFieldRules), and the budget month is derived (R3) unless overridden.

export interface OperationFormState {
  readonly amountText: string;
  readonly date: string;
  readonly categoryId: Id | null;
  readonly sourceAccountId: Id | null;
  readonly destAccountId: Id | null;
  readonly projectId: Id | null;
  readonly loanId: Id | null;
  readonly loanPerson: string;
  readonly label: string;
  readonly note: string;
  /** Manual budget month ('YYYY-MM'), or null to keep the derived one. */
  readonly budgetMonthOverride: string | null;
  /** Edit only: send budgetMonth null to drop a stored manual override (P1.5 plan Q9). */
  readonly clearOverride: boolean;
}

export type FieldMode = "required" | "optional" | "hidden";

export interface VisibleFields {
  readonly sourceAccountId: FieldMode;
  readonly destAccountId: FieldMode;
  readonly projectId: FieldMode;
  /** Loan: the person (the receivable is created by the server). Repayment: pick an open loan. */
  readonly loan: "person" | "select" | "hidden";
  /** Adjustment: exactly one of the two accounts. */
  readonly exactlyOneAccount: boolean;
}

export function emptyForm(today: string): OperationFormState {
  return {
    amountText: "",
    date: today,
    categoryId: null,
    sourceAccountId: null,
    destAccountId: null,
    projectId: null,
    loanId: null,
    loanPerson: "",
    label: "",
    note: "",
    budgetMonthOverride: null,
    clearOverride: false,
  };
}

export function formFromOperation(operation: OperationDto, loanPerson: string): OperationFormState {
  return {
    amountText: String(operation.amount),
    date: operation.date,
    categoryId: operation.categoryId,
    sourceAccountId: operation.sourceAccountId,
    destAccountId: operation.destAccountId,
    projectId: operation.projectId,
    loanId: operation.loanId,
    loanPerson,
    label: operation.label ?? "",
    note: operation.note ?? "",
    budgetMonthOverride: null,
    clearOverride: false,
  };
}

export function visibleFields(operationClass: OperationClass): VisibleFields {
  const rule = operationFieldRules(operationClass);
  const mode = (field: "sourceAccountId" | "destAccountId" | "projectId"): FieldMode =>
    rule.required.includes(field) ? "required" : rule.optional.includes(field) ? "optional" : "hidden";
  return {
    sourceAccountId: mode("sourceAccountId"),
    destAccountId: mode("destAccountId"),
    projectId: mode("projectId"),
    loan: operationClass === "loan" ? "person" : operationClass === "repayment" ? "select" : "hidden",
    exactlyOneAccount: rule.exactlyOneAccount,
  };
}

/** Form field names the user can see for a class, used to place server issues under their field. */
export function shownFieldNames(operationClass: OperationClass | null): string[] {
  const names = ["amount", "date", "categoryId", "label", "note", "budgetMonth"];
  if (operationClass === null) return names;
  const visible = visibleFields(operationClass);
  for (const field of ["sourceAccountId", "destAccountId", "projectId"] as const) {
    if (visible[field] !== "hidden") names.push(field);
  }
  if (visible.loan === "person") names.push("loanPerson");
  if (visible.loan === "select") names.push("loanId");
  return names;
}

/** A new category keeps the common fields and drops the links its class does not use. */
export function withCategory(form: OperationFormState, category: ReferenceCategory): OperationFormState {
  const visible = visibleFields(category.class);
  return {
    ...form,
    categoryId: category.id,
    sourceAccountId: visible.sourceAccountId === "hidden" ? null : form.sourceAccountId,
    destAccountId: visible.destAccountId === "hidden" ? null : form.destAccountId,
    projectId: visible.projectId === "hidden" ? null : form.projectId,
    loanId: visible.loan === "select" ? form.loanId : null,
    loanPerson: visible.loan === "person" ? form.loanPerson : "",
  };
}

/** On edit: the stored row, so the line predicts what the server keeps (P1.5 plan Q9). */
export interface PreviousMonth {
  readonly date: string;
  readonly rollsOver: boolean;
  readonly budgetMonth: string;
}

export interface DerivedLine {
  readonly text: string;
  readonly budgetMonth: string | null;
}

/** "Dépense · Transport et alimentation · octobre 2026" (design brief §7, R2, R3). */
export function derivedLine(
  form: OperationFormState,
  category: ReferenceCategory | undefined,
  envelopes: readonly ReferenceEnvelope[],
  rolloverDay: number,
  previous?: PreviousMonth,
): DerivedLine {
  if (category === undefined) {
    return { text: "Choisis une catégorie.", budgetMonth: null };
  }
  let budgetMonth: string | null = null;
  if (form.budgetMonthOverride !== null) {
    budgetMonth = form.budgetMonthOverride;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
    const next = { date: form.date, rollsOver: category.rollsOver };
    budgetMonth =
      previous === undefined
        ? budgetMonthFor({ ...next, rolloverDay })
        : budgetMonthAfterEdit({ previous, next, requested: form.clearOverride ? null : undefined, rolloverDay });
  }
  const envelope = envelopes.find((e) => e.id === category.envelopeId)?.name;
  const middle = envelope ?? (category.class === "transfer" ? "neutre" : null);
  const parts = [CLASS_LABELS[category.class], middle, budgetMonth === null ? null : formatMonth(budgetMonth)];
  return { text: parts.filter((part) => part !== null).join(" · "), budgetMonth };
}

type BuildResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: ValidationIssue[] };

// Checks the client can make before sending; everything else is decided by the server.
function localIssues(form: OperationFormState): { amount: number | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const amount = parseAmountInput(form.amountText);
  if (amount === null) issues.push({ field: "amount", code: "invalid_amount" });
  if (form.categoryId === null) issues.push({ field: "categoryId", code: "required" });
  return { amount, issues };
}

function links(form: OperationFormState, operationClass: OperationClass) {
  const visible = visibleFields(operationClass);
  return {
    sourceAccountId: visible.sourceAccountId === "hidden" ? null : form.sourceAccountId,
    destAccountId: visible.destAccountId === "hidden" ? null : form.destAccountId,
    projectId: visible.projectId === "hidden" ? null : form.projectId,
  };
}

const text = (value: string): string | null => (value.trim() === "" ? null : value.trim());

export function buildCreateRequest(form: OperationFormState, category: ReferenceCategory): BuildResult<CreateOperationRequest> {
  const { amount, issues } = localIssues(form);
  if (amount === null || issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      date: form.date,
      amount,
      categoryId: category.id,
      label: text(form.label),
      note: text(form.note),
      ...links(form, category.class),
      // Loan: the receivable is created from loanPerson; repayment: the chosen open loan (R10).
      ...(category.class === "loan" ? { loanPerson: form.loanPerson.trim() === "" ? null : form.loanPerson.trim() } : {}),
      ...(category.class === "repayment" ? { loanId: form.loanId } : {}),
      ...(form.budgetMonthOverride !== null ? { budgetMonth: form.budgetMonthOverride } : {}),
    },
  };
}

export function buildUpdateRequest(
  form: OperationFormState,
  category: ReferenceCategory,
  operation: OperationDto,
): BuildResult<UpdateOperationRequest> {
  const { amount, issues } = localIssues(form);
  if (amount === null || issues.length > 0) return { ok: false, issues };
  let budgetMonth: string | null | undefined;
  if (form.budgetMonthOverride !== null) budgetMonth = form.budgetMonthOverride;
  else if (form.clearOverride) budgetMonth = null;
  return {
    ok: true,
    value: {
      expectedUpdatedAt: operation.updatedAt,
      date: form.date,
      amount,
      categoryId: category.id,
      label: text(form.label),
      note: text(form.note),
      ...links(form, category.class),
      // docs/decisions.md P1.5: a loan's loanId never changes; loanPerson exists only on loans.
      ...(category.class === "loan" && form.loanPerson.trim() !== "" ? { loanPerson: form.loanPerson.trim() } : {}),
      ...(category.class === "repayment" ? { loanId: form.loanId } : {}),
      ...(budgetMonth !== undefined ? { budgetMonth } : {}),
    },
  };
}
