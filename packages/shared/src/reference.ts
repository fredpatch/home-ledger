// Enumerations shared by the database schema (CHECK constraints) and the domain code.

// docs/spec.md §R1 account types.
export const ACCOUNT_TYPES = ["bank", "mobile", "cash", "savings", "card"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// docs/spec.md §R1/§R12: weekly for current/mobile/cash/card, monthly for savings.
export const RECONCILIATION_FREQUENCIES = ["weekly", "monthly"] as const;
export type ReconciliationFrequency = (typeof RECONCILIATION_FREQUENCIES)[number];

// docs/spec.md §R4: "pot du mois" or "courant / carte".
export const ENVELOPE_SOURCES = ["pot", "current_card"] as const;
export type EnvelopeSource = (typeof ENVELOPE_SOURCES)[number];

// docs/spec.md §R9: Usage = Personnel / Activité / Mixte.
export const OPERATION_USAGES = ["personal", "activity", "mixed"] as const;
export type OperationUsage = (typeof OPERATION_USAGES)[number];

export const PROJECT_STATUSES = ["active", "closed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// docs/spec.md §R10: a loan is settled by repayments.
export const LOAN_STATUSES = ["open", "settled"] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];
