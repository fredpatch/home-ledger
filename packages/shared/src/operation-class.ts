// docs/spec.md §R2 — the category decides the class; the class decides every total.
export const OPERATION_CLASSES = [
  "revenue",
  "expense",
  "transfer",
  "savings",
  "project",
  "loan",
  "repayment",
  "adjustment",
] as const;

export type OperationClass = (typeof OPERATION_CLASSES)[number];

// docs/spec.md §Modèle de données: statut brouillon / validée.
export const OPERATION_STATUSES = ["draft", "validated"] as const;

export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export function isOperationClass(value: unknown): value is OperationClass {
  return typeof value === "string" && (OPERATION_CLASSES as readonly string[]).includes(value);
}
