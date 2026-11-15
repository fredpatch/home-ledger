import { and, asc, eq, isNull } from "drizzle-orm";
import type { ReferenceData } from "@suivi/shared";
import type { AppDatabase } from "../../db/connection.js";
import { accounts, categories, envelopes, loans, operations, projects } from "../../db/schema.js";
import { repaidAmount } from "../operations/operations.service.js";

// GET /api/reference (P1.6 plan Q1): read-only referential for the operation form. Active rows only.
export function getReferenceData(db: AppDatabase): ReferenceData {
  const accountRows = db
    .select({ id: accounts.id, name: accounts.name, type: accounts.type, fundsProjects: accounts.fundsProjects })
    .from(accounts)
    .where(eq(accounts.active, true))
    .orderBy(asc(accounts.sortOrder), asc(accounts.id))
    .all();
  const envelopeRows = db
    .select({ id: envelopes.id, name: envelopes.name, source: envelopes.source })
    .from(envelopes)
    .orderBy(asc(envelopes.name))
    .all();
  const categoryRows = db
    .select({
      id: categories.id,
      name: categories.name,
      class: categories.class,
      envelopeId: categories.envelopeId,
      rollsOver: categories.rollsOver,
    })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.name))
    .all();
  const projectRows = db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.status, "active"))
    .orderBy(asc(projects.name))
    .all();
  // docs/decisions.md P1.5: a loan is live if and only if its loan operation is live.
  const loanRows = db
    .selectDistinct({ id: loans.id, person: loans.person, amount: loans.amount, date: loans.date })
    .from(loans)
    .innerJoin(operations, and(eq(operations.loanId, loans.id), eq(operations.class, "loan"), isNull(operations.deletedAt)))
    .where(eq(loans.status, "open"))
    .orderBy(asc(loans.date), asc(loans.id))
    .all();
  const openLoans = loanRows.map((loan) => ({ ...loan, remaining: loan.amount - repaidAmount(db, loan.id, null) }));
  return { accounts: accountRows, envelopes: envelopeRows, categories: categoryRows, projects: projectRows, openLoans };
}
