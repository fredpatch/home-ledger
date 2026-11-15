// Enumerations shared by the database schema (CHECK constraints) and the domain code.

import type { OperationClass } from "./operation-class.js";
import type { Id } from "./operation-rules.js";

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

// GET /api/reference (P1.6): the referential a client needs to build an operation form.
// Only active rows; open loans are those whose loan operation is live (docs/decisions.md P1.5).

export interface ReferenceAccount {
  readonly id: Id;
  readonly name: string;
  readonly type: AccountType;
  readonly fundsProjects: boolean;
}

export interface ReferenceEnvelope {
  readonly id: Id;
  readonly name: string;
  readonly source: EnvelopeSource;
}

export interface ReferenceCategory {
  readonly id: Id;
  readonly name: string;
  readonly class: OperationClass;
  readonly envelopeId: Id | null;
  readonly rollsOver: boolean;
}

export interface ReferenceProject {
  readonly id: Id;
  readonly name: string;
}

export interface ReferenceLoan {
  readonly id: Id;
  readonly person: string;
  readonly amount: number;
  readonly date: string;
  /** Amount minus the live repayments (R10). */
  readonly remaining: number;
}

export interface ReferenceData {
  readonly accounts: readonly ReferenceAccount[];
  readonly envelopes: readonly ReferenceEnvelope[];
  readonly categories: readonly ReferenceCategory[];
  readonly projects: readonly ReferenceProject[];
  readonly openLoans: readonly ReferenceLoan[];
}
