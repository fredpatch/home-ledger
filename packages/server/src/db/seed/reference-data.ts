import type { AccountType, EnvelopeSource, OperationClass, ReconciliationFrequency } from "@suivi/shared";

// Source: workbook "Suivi financier personnel Fred v9.3" (Paramètres, Budget mensuel); docs/spec.md §R1, §R4.

export interface AccountSeed {
  readonly name: string;
  readonly type: AccountType;
  readonly reconciliationFrequency: ReconciliationFrequency;
  readonly fundsProjects: boolean;
}

// Order = sort_order.
export const ACCOUNT_SEEDS: readonly AccountSeed[] = [
  { name: "BGFI courant", type: "bank", reconciliationFrequency: "weekly", fundsProjects: false },
  { name: "BGFI mobile", type: "mobile", reconciliationFrequency: "weekly", fundsProjects: false },
  { name: "Espèces", type: "cash", reconciliationFrequency: "weekly", fundsProjects: false },
  { name: "BGFI épargne", type: "savings", reconciliationFrequency: "monthly", fundsProjects: true },
  { name: "UGB épargne", type: "savings", reconciliationFrequency: "monthly", fundsProjects: false },
  { name: "Carte prépayée", type: "card", reconciliationFrequency: "weekly", fundsProjects: false },
];

export interface EnvelopeSeed {
  readonly name: string;
  readonly source: EnvelopeSource;
}

export const ENVELOPE_SEEDS: readonly EnvelopeSeed[] = [
  { name: "Maison", source: "pot" },
  { name: "Transport et alimentation", source: "pot" },
  { name: "Famille", source: "pot" },
  { name: "Loisirs et personnel", source: "pot" },
  { name: "Mobile et divers", source: "pot" },
  { name: "Abonnements", source: "current_card" },
  { name: "Voiture", source: "current_card" },
  { name: "Santé", source: "current_card" },
];

export interface CategorySeed {
  readonly name: string;
  readonly class: OperationClass;
  readonly envelope: string | null;
  readonly rollsOver: boolean;
}

const expense = (name: string, envelope: string): CategorySeed => ({ name, class: "expense", envelope, rollsOver: false });
const other = (name: string, cls: OperationClass, rollsOver = false): CategorySeed => ({
  name,
  class: cls,
  envelope: null,
  rollsOver,
});

export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  expense("Électricité", "Maison"),
  expense("Internet maison", "Maison"),
  expense("Carburant", "Transport et alimentation"),
  expense("Courses", "Transport et alimentation"),
  expense("Restaurant", "Transport et alimentation"),
  expense("Famille", "Famille"),
  expense("Loisirs", "Loisirs et personnel"),
  expense("Soins personnels", "Loisirs et personnel"),
  expense("Internet mobile", "Mobile et divers"),
  expense("Autre", "Mobile et divers"),
  expense("Abonnements", "Abonnements"),
  expense("Voiture / entretien", "Voiture"),
  expense("Santé", "Santé"),
  // docs/spec.md §R3: only Salaire, Épargne and Chargement du pot roll over.
  other("Salaire", "revenue", true),
  other("Revenu développement", "revenue"),
  other("Prime / bonus", "revenue"),
  other("Cadeau / aide reçue", "revenue"),
  other("Vente", "revenue"),
  other("Autre revenu", "revenue"),
  other("Remboursement", "repayment"),
  other("Épargne", "savings", true),
  other("Achat projet", "project"),
  other("Prêt / avance", "loan"),
  other("Ajustement", "adjustment"),
  other("Chargement du pot", "transfer", true),
  other("Retrait espèces", "transfer"),
  other("Recharge carte", "transfer"),
  other("Renfort", "transfer"),
  other("Virement interne", "transfer"),
];

export const SEED_BUDGET_MONTH = "2026-10";

// Budget per category (XAF) for October 2026.
export const BUDGET_SEEDS: readonly { readonly category: string; readonly amount: number }[] = [
  { category: "Électricité", amount: 50000 },
  { category: "Internet maison", amount: 25500 },
  { category: "Carburant", amount: 30000 },
  { category: "Courses", amount: 50000 },
  { category: "Restaurant", amount: 30000 },
  { category: "Famille", amount: 100000 },
  { category: "Loisirs", amount: 100000 },
  { category: "Soins personnels", amount: 10000 },
  { category: "Internet mobile", amount: 10000 },
  { category: "Autre", amount: 30000 },
  { category: "Abonnements", amount: 55000 },
  { category: "Voiture / entretien", amount: 50000 },
  { category: "Santé", amount: 0 },
];

export const SETTING_SEEDS: readonly { readonly key: string; readonly value: string }[] = [
  { key: "savings_target_percent", value: "30" },
  { key: "budget_rollover_day", value: "25" },
  { key: "cash_tolerance", value: "5000" },
  { key: "opening_date", value: "2026-10-01" },
  // docs/decisions.md 2026-10-08 + P1.5 plan Q4: tolerance before the pot warning.
  { key: "pot_budget_tolerance", value: "0" },
];
