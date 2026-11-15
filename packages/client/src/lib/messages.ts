import type { ApiErrorCode, OperationClass, PotWarning, ValidationIssue, ValidationIssueCode } from "@suivi/shared";
import { formatAmount, formatMonth } from "./format.js";

// French UI text for stable server codes (docs/design-brief.md §9). Raw codes are never shown.

export const CLASS_LABELS: Record<OperationClass, string> = {
  revenue: "Revenu",
  expense: "Dépense",
  transfer: "Transfert",
  savings: "Épargne",
  project: "Projet",
  loan: "Prêt",
  repayment: "Remboursement",
  adjustment: "Ajustement",
};

export const FIELD_LABELS: Record<string, string> = {
  date: "Date",
  amount: "Montant",
  categoryId: "Catégorie",
  sourceAccountId: "Compte de départ",
  destAccountId: "Compte d'arrivée",
  projectId: "Projet",
  loanId: "Prêt",
  loanPerson: "Personne",
  label: "Libellé",
  note: "Note",
  budgetMonth: "Mois budgétaire",
  savingsTargetPercent: "Objectif d'épargne (%)",
  budgetRolloverDay: "Jour de bascule du mois",
  cashTolerance: "Tolérance espèces (XAF)",
  potBudgetTolerance: "Tolérance du pot (XAF)",
  openingDate: "Date d'ouverture",
};

const API_ERRORS: Record<ApiErrorCode, string> = {
  auth_required: "Ta session a expiré. Reconnecte-toi.",
  invalid_credentials: "Mot de passe incorrect.",
  too_many_attempts: "Trop de tentatives. Réessaie dans quelques minutes.",
  csrf_invalid: "La page n'est plus à jour. Recharge-la puis réessaie.",
  origin_rejected: "Requête refusée. Ouvre l'application depuis son adresse habituelle.",
  invalid_request: "Requête invalide. Recharge la page puis réessaie.",
  validation_failed: "Certains champs sont à corriger.",
  not_found: "Cette opération n'existe plus.",
  conflict: "Cette opération a changé ailleurs.",
  internal_error: "Une erreur est survenue côté serveur. Réessaie.",
};

export function apiErrorMessage(code: ApiErrorCode | "network"): string {
  return code === "network" ? "Serveur injoignable. Vérifie la connexion puis réessaie." : API_ERRORS[code];
}

const ISSUE_MESSAGES: Record<ValidationIssueCode, string> = {
  invalid_class: "Catégorie invalide.",
  invalid_amount: "Montant requis : un nombre entier positif.",
  field_required: "Champ requis pour cette catégorie.",
  field_forbidden: "Ce champ ne s'applique pas à cette catégorie.",
  same_account: "Choisis deux comptes différents.",
  adjustment_one_account: "Choisis un seul compte : départ ou arrivée.",
  required: "Champ requis.",
  invalid: "Valeur invalide.",
  too_long: "Texte trop long.",
  unknown_field: "Champ non accepté.",
  invalid_date: "Date invalide.",
  invalid_budget_month: "Mois invalide.",
  not_found: "Introuvable : recharge la page.",
  inactive: "Cet élément n'est plus actif.",
  not_project_funding: "Un projet se paie depuis BGFI épargne uniquement.",
  exceeds_remaining: "Le montant dépasse ce qui reste dû sur le prêt.",
  class_change_forbidden: "Choisis une catégorie de la même classe, ou supprime puis ressaisis.",
  has_repayments: "Ce prêt a des remboursements : supprime-les d'abord.",
  read_only: "Ce réglage n'est pas modifiable ici.",
  out_of_range: "Valeur hors limites.",
};

// Settings bounds, shown with out_of_range (packages/shared/src/settings.ts).
const RANGE_HINTS: Record<string, string> = {
  budgetRolloverDay: "Entre 1 et 28.",
  savingsTargetPercent: "Entre 0 et 100.",
  cashTolerance: "0 ou plus.",
  potBudgetTolerance: "0 ou plus.",
};

export function issueMessage(issue: ValidationIssue): string {
  const message = ISSUE_MESSAGES[issue.code];
  const hint = issue.code === "out_of_range" ? RANGE_HINTS[issue.field] : undefined;
  return hint === undefined ? message : `${message} ${hint}`;
}

/** Groups issues by field; issues on fields the form does not show go under "form". */
export function issuesByField(issues: readonly ValidationIssue[], shownFields: readonly string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = shownFields.includes(issue.field) ? issue.field : "form";
    const text = key === "form" && FIELD_LABELS[issue.field] ? `${FIELD_LABELS[issue.field]} : ${issueMessage(issue)}` : issueMessage(issue);
    (grouped[key] ??= []).push(text);
  }
  return grouped;
}

/** docs/decisions.md 2026-10-08: values come from the warning payload, never hardcoded. */
export function potWarningMessage(warning: PotWarning): string {
  return `Les budgets du pot de ${formatMonth(warning.budgetMonth)} (${formatAmount(warning.potBudgets)}) dépassent le pot du mois (${formatAmount(warning.pot)}).`;
}
