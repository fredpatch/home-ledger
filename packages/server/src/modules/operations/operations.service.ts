import { and, desc, eq, gte, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import {
  budgetMonthAfterEdit,
  budgetMonthFor,
  checkPotBudget,
  POT_CATEGORY_NAME,
  validateOperationShape,
  type ApiErrorCode,
  type CreateOperationRequest,
  type Id,
  type OperationDto,
  type OperationListQuery,
  type OperationUsage,
  type PotWarning,
  type UpdateOperationRequest,
  type ValidationIssue,
} from "@suivi/shared";
import type { Clock } from "../../config.js";
import type { AppDatabase } from "../../db/connection.js";
import { accounts, budgets, categories, changeLog, envelopes, loans, operations, projects } from "../../db/schema.js";
import { readSettings } from "../settings/settings.service.js";

type OperationRow = typeof operations.$inferSelect;
type CategoryRow = typeof categories.$inferSelect;
type LoanRow = typeof loans.$inferSelect;

// Thrown inside a transaction so nothing is written; the controller maps it to the HTTP answer.
export class OperationFailure extends Error {
  constructor(
    readonly status: 404 | 409 | 422,
    readonly error: ApiErrorCode,
    readonly issues?: readonly ValidationIssue[],
  ) {
    super(error);
    this.name = "OperationFailure";
  }
}

export interface OperationWriteResult {
  readonly operation: OperationDto;
  readonly warnings: readonly PotWarning[];
}

// The editable state of an operation, after merging a request into the stored row.
interface Candidate {
  readonly date: string;
  readonly amount: number;
  readonly categoryId: Id;
  readonly label: string | null;
  readonly note: string | null;
  readonly client: string | null;
  readonly usage: OperationUsage | null;
  readonly sourceAccountId: Id | null;
  readonly destAccountId: Id | null;
  readonly projectId: Id | null;
  readonly loanId: Id | null;
}

export function toOperationDto(row: OperationRow): OperationDto {
  return {
    id: row.id,
    date: row.date,
    budgetMonth: row.budgetMonth,
    label: row.label,
    amount: row.amount,
    categoryId: row.categoryId,
    class: row.class,
    sourceAccountId: row.sourceAccountId,
    destAccountId: row.destAccountId,
    projectId: row.projectId,
    client: row.client,
    usage: row.usage,
    loanId: row.loanId,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listOperations(db: AppDatabase, query: OperationListQuery): OperationDto[] {
  const conditions: (SQL | undefined)[] = [isNull(operations.deletedAt)];
  if (query.month !== undefined) conditions.push(eq(operations.budgetMonth, query.month));
  if (query.from !== undefined) conditions.push(gte(operations.date, query.from));
  if (query.to !== undefined) conditions.push(lte(operations.date, query.to));
  if (query.categoryId !== undefined) conditions.push(eq(operations.categoryId, query.categoryId));
  if (query.class !== undefined) conditions.push(eq(operations.class, query.class));
  if (query.accountId !== undefined) {
    conditions.push(or(eq(operations.sourceAccountId, query.accountId), eq(operations.destAccountId, query.accountId)));
  }
  return db
    .select()
    .from(operations)
    .where(and(...conditions))
    .orderBy(desc(operations.date), desc(operations.id))
    .limit(query.limit)
    .offset(query.offset)
    .all()
    .map(toOperationDto);
}

export function getOperation(db: AppDatabase, id: Id): OperationDto {
  return toOperationDto(liveOperation(db, id));
}

export function createOperation(db: AppDatabase, clock: Clock, request: CreateOperationRequest): OperationWriteResult {
  return db.transaction((tx) => {
    const settings = readSettings(tx);
    const { budgetMonth: requestedMonth, loanPerson, ...fields } = request;
    const candidate: Candidate = {
      label: null,
      note: null,
      client: null,
      usage: null,
      sourceAccountId: null,
      destAccountId: null,
      projectId: null,
      loanId: null,
      ...fields,
    };
    const category = tx.select().from(categories).where(eq(categories.id, candidate.categoryId)).get();
    const issues = checkCandidate(tx, candidate, category, null, loanPerson);
    if (category === undefined || issues.length > 0) {
      throw new OperationFailure(422, "validation_failed", issues);
    }
    const nowIso = clock().toISOString();
    let loanId = candidate.loanId;
    if (category.class === "loan" && typeof loanPerson === "string") {
      // docs/decisions.md 2026-10-07: the receivable is created in the same transaction (R10).
      loanId = tx
        .insert(loans)
        .values({ person: loanPerson, amount: candidate.amount, date: candidate.date })
        .returning({ id: loans.id })
        .get().id;
    }
    const row = tx
      .insert(operations)
      .values({
        ...candidate,
        loanId,
        class: category.class,
        budgetMonth:
          requestedMonth ??
          budgetMonthFor({ date: candidate.date, rollsOver: category.rollsOver, rolloverDay: settings.budgetRolloverDay }),
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .get();
    if (row.class === "repayment" && row.loanId !== null) {
      syncLoanStatus(tx, row.loanId);
    }
    const warnings = potWarnings(tx, category.name === POT_CATEGORY_NAME ? [row.budgetMonth] : [], settings.potBudgetTolerance);
    return { operation: toOperationDto(row), warnings };
  });
}

export function updateOperation(
  db: AppDatabase,
  clock: Clock,
  id: Id,
  request: UpdateOperationRequest,
): OperationWriteResult {
  return db.transaction((tx) => {
    const settings = readSettings(tx);
    const previous = liveOperation(tx, id);
    if (previous.updatedAt !== request.expectedUpdatedAt) {
      throw new OperationFailure(409, "conflict");
    }
    const { expectedUpdatedAt: _lock, budgetMonth: requestedMonth, loanPerson, ...changes } = request;
    const candidate: Candidate = { ...pickCandidate(previous), ...changes };
    const previousCategory = categoryById(tx, previous.categoryId);
    const category = tx.select().from(categories).where(eq(categories.id, candidate.categoryId)).get();
    const issues = checkCandidate(tx, candidate, category, previous, loanPerson);
    if (category === undefined || issues.length > 0) {
      throw new OperationFailure(422, "validation_failed", issues);
    }
    const budgetMonth = budgetMonthAfterEdit({
      previous: { date: previous.date, rollsOver: previousCategory.rollsOver, budgetMonth: previous.budgetMonth },
      next: { date: candidate.date, rollsOver: category.rollsOver },
      requested: requestedMonth,
      rolloverDay: settings.budgetRolloverDay,
    });
    const row = tx
      .update(operations)
      .set({ ...candidate, budgetMonth, updatedAt: nextUpdatedAt(clock, previous.updatedAt) })
      .where(eq(operations.id, id))
      .returning()
      .get();
    logChange(tx, "operations", id, previous, row);

    if (row.class === "loan" && row.loanId !== null) {
      updateLoanFromOperation(tx, row.loanId, row, loanPerson);
    }
    if (row.class === "repayment") {
      for (const loanId of new Set([previous.loanId, row.loanId])) {
        if (loanId !== null) syncLoanStatus(tx, loanId);
      }
    }
    const potMonths = [previousCategory, category].some((c) => c.name === POT_CATEGORY_NAME)
      ? [previous.budgetMonth, row.budgetMonth]
      : [];
    return { operation: toOperationDto(row), warnings: potWarnings(tx, potMonths, settings.potBudgetTolerance) };
  });
}

export function deleteOperation(db: AppDatabase, clock: Clock, id: Id, expectedUpdatedAt: string): readonly PotWarning[] {
  return db.transaction((tx) => {
    const settings = readSettings(tx);
    const previous = liveOperation(tx, id);
    if (previous.updatedAt !== expectedUpdatedAt) {
      throw new OperationFailure(409, "conflict");
    }
    if (previous.class === "loan" && previous.loanId !== null && repaidAmount(tx, previous.loanId, null) > 0) {
      throw new OperationFailure(422, "validation_failed", [{ field: "id", code: "has_repayments" }]);
    }
    const nowIso = nextUpdatedAt(clock, previous.updatedAt);
    // Soft delete only (docs/spec.md §Modèle de données); a trigger forbids DELETE.
    const row = tx
      .update(operations)
      .set({ deletedAt: nowIso, updatedAt: nowIso })
      .where(eq(operations.id, id))
      .returning()
      .get();
    logChange(tx, "operations", id, previous, row);
    if (row.class === "repayment" && row.loanId !== null) {
      syncLoanStatus(tx, row.loanId);
    }
    const category = categoryById(tx, row.categoryId);
    return potWarnings(tx, category.name === POT_CATEGORY_NAME ? [row.budgetMonth] : [], settings.potBudgetTolerance);
  });
}

function liveOperation(db: AppDatabase, id: Id): OperationRow {
  const row = db
    .select()
    .from(operations)
    .where(and(eq(operations.id, id), isNull(operations.deletedAt)))
    .get();
  if (row === undefined) {
    throw new OperationFailure(404, "not_found");
  }
  return row;
}

function categoryById(db: AppDatabase, id: Id): CategoryRow {
  const row = db.select().from(categories).where(eq(categories.id, id)).get();
  if (row === undefined) {
    throw new Error("category of a stored operation is missing");
  }
  return row;
}

function pickCandidate(row: OperationRow): Candidate {
  const { date, amount, categoryId, label, note, client, usage, sourceAccountId, destAccountId, projectId, loanId } = row;
  return { date, amount, categoryId, label, note, client, usage, sourceAccountId, destAccountId, projectId, loanId };
}

// updatedAt is the optimistic-lock token (P1.5 plan Q7): it must change on every write, even within one millisecond.
function nextUpdatedAt(clock: Clock, previous: string): string {
  const now = clock().getTime();
  return new Date(Math.max(now, Date.parse(previous) + 1)).toISOString();
}

/**
 * Business validation before any write (docs/spec.md §R2, §R7, §R10, §Modèle de données).
 * `previous` is null on create. References are checked for activity only when they change.
 */
function checkCandidate(
  db: AppDatabase,
  candidate: Candidate,
  category: CategoryRow | undefined,
  previous: OperationRow | null,
  loanPerson: string | null | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const changed = (field: keyof Candidate) => previous === null || previous[field] !== candidate[field];

  if (category === undefined) {
    return [{ field: "categoryId", code: "not_found" }];
  }
  if (changed("categoryId") && !category.active) {
    issues.push({ field: "categoryId", code: "inactive" });
  }
  if (previous !== null && previous.class !== category.class) {
    issues.push({ field: "categoryId", code: "class_change_forbidden" });
    return issues;
  }

  // Loan (R10): the receivable is created with the operation, so the client never picks a loanId.
  const isLoan = category.class === "loan";
  if (isLoan && previous === null) {
    if (candidate.loanId !== null) issues.push({ field: "loanId", code: "field_forbidden" });
    if (loanPerson === undefined || loanPerson === null) issues.push({ field: "loanPerson", code: "required" });
  } else if (isLoan && changed("loanId")) {
    issues.push({ field: "loanId", code: "field_forbidden" });
  } else if (!isLoan && loanPerson !== undefined) {
    issues.push({ field: "loanPerson", code: "field_forbidden" });
  }

  // R2 field matrix. A new loan has no loanId yet: 0 stands for "created with this operation".
  const shapeLoanId = isLoan && previous === null ? 0 : candidate.loanId;
  for (const issue of validateOperationShape({ ...candidate, loanId: shapeLoanId, operationClass: category.class })) {
    issues.push({ field: issue.field === "operationClass" ? "categoryId" : issue.field, code: issue.code });
  }

  for (const field of ["sourceAccountId", "destAccountId"] as const) {
    const accountId = candidate[field];
    if (accountId === null) continue;
    const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (account === undefined) {
      issues.push({ field, code: "not_found" });
    } else if (changed(field) && !account.active) {
      issues.push({ field, code: "inactive" });
    } else if (field === "sourceAccountId" && candidate.projectId !== null && !account.fundsProjects) {
      // R7: projects are paid from BGFI épargne only.
      issues.push({ field, code: "not_project_funding" });
    }
  }

  if (candidate.projectId !== null && db.select().from(projects).where(eq(projects.id, candidate.projectId)).get() === undefined) {
    issues.push({ field: "projectId", code: "not_found" });
  }

  if (category.class === "repayment" && candidate.loanId !== null) {
    const loan = openableLoan(db, candidate.loanId);
    if (loan === undefined) {
      issues.push({ field: "loanId", code: "not_found" });
    } else if (candidate.amount > loan.amount - repaidAmount(db, loan.id, previous?.id ?? null)) {
      // P1.5 plan Q6.
      issues.push({ field: "amount", code: "exceeds_remaining" });
    }
  }
  if (isLoan && previous !== null && candidate.loanId !== null && repaidAmount(db, candidate.loanId, null) > candidate.amount) {
    issues.push({ field: "amount", code: "exceeds_remaining" });
  }
  return issues;
}

// A loan can be repaid only while its loan operation is live.
function openableLoan(db: AppDatabase, loanId: Id): LoanRow | undefined {
  const liveLoanOperation = db
    .select({ id: operations.id })
    .from(operations)
    .where(and(eq(operations.loanId, loanId), eq(operations.class, "loan"), isNull(operations.deletedAt)))
    .get();
  return liveLoanOperation === undefined ? undefined : db.select().from(loans).where(eq(loans.id, loanId)).get();
}

/** Sum of the live repayments of a loan, optionally excluding one operation (the one being edited). */
function repaidAmount(db: AppDatabase, loanId: Id, excludeOperationId: Id | null): number {
  const conditions = [eq(operations.loanId, loanId), eq(operations.class, "repayment"), isNull(operations.deletedAt)];
  if (excludeOperationId !== null) conditions.push(ne(operations.id, excludeOperationId));
  const row = db
    .select({ total: sql<number>`coalesce(sum(${operations.amount}), 0)` })
    .from(operations)
    .where(and(...conditions))
    .get();
  return row?.total ?? 0;
}

// R10: a loan is settled once its repayments reach its amount.
function syncLoanStatus(db: AppDatabase, loanId: Id): void {
  const loan = db.select().from(loans).where(eq(loans.id, loanId)).get();
  if (loan === undefined) return;
  const status = repaidAmount(db, loanId, null) >= loan.amount ? "settled" : "open";
  if (status !== loan.status) {
    const after = db.update(loans).set({ status }).where(eq(loans.id, loanId)).returning().get();
    logChange(db, "loans", loanId, loan, after);
  }
}

// The receivable follows its loan operation (amount, date, person).
function updateLoanFromOperation(db: AppDatabase, loanId: Id, row: OperationRow, loanPerson: string | null | undefined): void {
  const loan = db.select().from(loans).where(eq(loans.id, loanId)).get();
  if (loan === undefined) return;
  const person = loanPerson ?? loan.person;
  if (loan.amount !== row.amount || loan.date !== row.date || loan.person !== person) {
    const after = db.update(loans).set({ amount: row.amount, date: row.date, person }).where(eq(loans.id, loanId)).returning().get();
    logChange(db, "loans", loanId, loan, after);
  }
  syncLoanStatus(db, loanId);
}

// docs/spec.md §Modèle de données journal_modifs: every edit or delete, in the same transaction.
function logChange(db: AppDatabase, tableName: string, rowId: Id, before: object, after: object): void {
  db.insert(changeLog)
    .values({ tableName, rowId, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) })
    .run();
}

// docs/decisions.md 2026-10-08 + P1.5 plan Q3: pot-funded budgets vs "Chargement du pot" operations.
function potWarnings(db: AppDatabase, months: readonly string[], tolerance: number): PotWarning[] {
  const warnings: PotWarning[] = [];
  for (const budgetMonth of new Set(months)) {
    const potBudgets = db
      .select({ total: sql<number>`coalesce(sum(${budgets.amount}), 0)` })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .innerJoin(envelopes, eq(categories.envelopeId, envelopes.id))
      .where(and(eq(budgets.budgetMonth, budgetMonth), eq(envelopes.source, "pot")))
      .get();
    const pot = db
      .select({ total: sql<number>`coalesce(sum(${operations.amount}), 0)` })
      .from(operations)
      .innerJoin(categories, eq(operations.categoryId, categories.id))
      .where(
        and(
          eq(operations.budgetMonth, budgetMonth),
          eq(categories.name, POT_CATEGORY_NAME),
          eq(operations.status, "validated"),
          isNull(operations.deletedAt),
        ),
      )
      .get();
    const warning = checkPotBudget({
      budgetMonth,
      potBudgets: potBudgets?.total ?? 0,
      pot: pot?.total ?? 0,
      tolerance,
    });
    if (warning !== null) warnings.push(warning);
  }
  return warnings;
}
