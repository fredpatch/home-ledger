import { isValidAmount } from "./money.js";
import { isOperationClass } from "./operation-class.js";
import type { OperationClass } from "./operation-class.js";

// Database ids are INTEGER primary keys.
export type Id = number;

export interface OperationShape {
  readonly operationClass: unknown;
  readonly amount: unknown;
  readonly sourceAccountId?: Id | null;
  readonly destAccountId?: Id | null;
  readonly projectId?: Id | null;
  readonly loanId?: Id | null;
}

export type OperationLinkField = "sourceAccountId" | "destAccountId" | "projectId" | "loanId";

export type OperationIssueCode =
  | "invalid_class"
  | "invalid_amount"
  | "field_required"
  | "field_forbidden"
  | "same_account"
  | "adjustment_one_account";

export interface OperationIssue {
  readonly code: OperationIssueCode;
  readonly field: OperationLinkField | "operationClass" | "amount" | "accounts";
}

interface FieldRule {
  readonly required: readonly OperationLinkField[];
  readonly optional: readonly OperationLinkField[];
}

// docs/spec.md §Modèle de données "Règles de cohérence", §R7 (transfer may link a project),
// §R10 (loan links its receivable). Any field not listed for a class is forbidden.
// Adjustment is handled separately: exactly one account.
const FIELD_RULES: Record<Exclude<OperationClass, "adjustment">, FieldRule> = {
  revenue: { required: ["destAccountId"], optional: [] },
  expense: { required: ["sourceAccountId"], optional: [] },
  transfer: { required: ["sourceAccountId", "destAccountId"], optional: ["projectId"] },
  savings: { required: ["sourceAccountId", "destAccountId"], optional: [] },
  project: { required: ["sourceAccountId", "projectId"], optional: [] },
  loan: { required: ["sourceAccountId", "loanId"], optional: [] },
  repayment: { required: ["destAccountId", "loanId"], optional: [] },
};

const LINK_FIELDS: readonly OperationLinkField[] = [
  "sourceAccountId",
  "destAccountId",
  "projectId",
  "loanId",
];

function isPresent(value: Id | null | undefined): boolean {
  return value !== null && value !== undefined;
}

/** Returns every consistency issue of an operation; an empty array means the combination is allowed. */
export function validateOperationShape(shape: OperationShape): OperationIssue[] {
  const issues: OperationIssue[] = [];

  if (!isValidAmount(shape.amount)) {
    issues.push({ code: "invalid_amount", field: "amount" });
  }

  if (!isOperationClass(shape.operationClass)) {
    issues.push({ code: "invalid_class", field: "operationClass" });
    return issues;
  }

  const hasSource = isPresent(shape.sourceAccountId);
  const hasDest = isPresent(shape.destAccountId);

  if (shape.operationClass === "adjustment") {
    if (hasSource === hasDest) {
      issues.push({ code: "adjustment_one_account", field: "accounts" });
    }
    for (const field of ["projectId", "loanId"] as const) {
      if (isPresent(shape[field])) {
        issues.push({ code: "field_forbidden", field });
      }
    }
    return issues;
  }

  const rule = FIELD_RULES[shape.operationClass];
  for (const field of LINK_FIELDS) {
    const present = isPresent(shape[field]);
    if (rule.required.includes(field) && !present) {
      issues.push({ code: "field_required", field });
    } else if (!rule.required.includes(field) && !rule.optional.includes(field) && present) {
      issues.push({ code: "field_forbidden", field });
    }
  }

  if (hasSource && hasDest && shape.sourceAccountId === shape.destAccountId) {
    issues.push({ code: "same_account", field: "accounts" });
  }

  return issues;
}

export function isOperationShapeValid(shape: OperationShape): boolean {
  return validateOperationShape(shape).length === 0;
}
