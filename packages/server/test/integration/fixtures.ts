import type { OperationClass } from "@suivi/shared";
import type { OpenedDatabase } from "../../src/db/connection.js";
import { seedReference } from "../../src/db/seed/seed-reference.js";

export const CLASS_CATEGORY: Record<OperationClass, string> = {
  revenue: "Salaire",
  expense: "Courses",
  transfer: "Renfort",
  savings: "Épargne",
  project: "Achat projet",
  loan: "Prêt / avance",
  repayment: "Remboursement",
  adjustment: "Ajustement",
};

export interface OpFields {
  date?: string;
  budgetMonth?: string;
  amount?: unknown;
  categoryName?: string;
  class?: string;
  source?: number | null;
  dest?: number | null;
  project?: number | null;
  loan?: number | null;
  status?: string;
  sourceRef?: string | null;
}

export interface Fixture {
  projectId: number;
  loanId: number;
}

// Seeds reference data plus one project and one loan to link to.
export function prepare({ sqlite, db }: OpenedDatabase): Fixture {
  seedReference(db);
  const projectId = Number(sqlite.prepare(`INSERT INTO projects (name) VALUES ('Projet test')`).run().lastInsertRowid);
  const loanId = Number(
    sqlite.prepare(`INSERT INTO loans (person, amount, date) VALUES ('Ami', 10000, '2026-10-05')`).run().lastInsertRowid,
  );
  return { projectId, loanId };
}

export function categoryId(sqlite: OpenedDatabase["sqlite"], name: string): number {
  const row = sqlite.prepare(`SELECT id FROM categories WHERE name = ?`).get(name) as { id: number };
  return row.id;
}

export function insertOperation(sqlite: OpenedDatabase["sqlite"], f: OpFields, cls: OperationClass = "expense") {
  const categoryName = f.categoryName ?? CLASS_CATEGORY[cls];
  return sqlite
    .prepare(
      `INSERT INTO operations (date, budget_month, amount, category_id, class, source_account_id, dest_account_id, project_id, loan_id, status, source_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      f.date ?? "2026-10-10",
      f.budgetMonth ?? "2026-10",
      f.amount ?? 1000,
      categoryId(sqlite, categoryName),
      f.class ?? cls,
      f.source ?? null,
      f.dest ?? null,
      f.project ?? null,
      f.loan ?? null,
      f.status ?? "validated",
      f.sourceRef ?? null,
    );
}
