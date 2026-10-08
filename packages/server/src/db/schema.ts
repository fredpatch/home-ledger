import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  ACCOUNT_TYPES,
  ENVELOPE_SOURCES,
  LOAN_STATUSES,
  OPERATION_CLASSES,
  OPERATION_STATUSES,
  OPERATION_USAGES,
  PROJECT_STATUSES,
  RECONCILIATION_FREQUENCIES,
} from "@suivi/shared";

// Kept in one file with no relative imports: drizzle-kit loads it directly.
// Column names are English snake_case; the FR↔EN mapping is in docs/decisions.md.

const inList = (column: string, values: readonly string[]) =>
  `"${column}" IN (${values.map((value) => `'${value}'`).join(", ")})`;
// typeof() rejects decimals that SQLite would otherwise store in an INTEGER-affinity column.
const isInt = (column: string) => `typeof("${column}") = 'integer'`;
const isBool = (column: string) => `"${column}" IN (0, 1)`;
// date() normalizes overflowing days (2026-02-30), so a round-trip comparison catches invalid dates.
const isDate = (column: string) => `date("${column}") IS "${column}"`;
const isMonth = (column: string) => `date("${column}" || '-01') IS "${column}" || '-01'`;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

const nowUtc = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// docs/spec.md §R1
export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    type: text("type", { enum: ACCOUNT_TYPES }).notNull(),
    openingBalance: integer("opening_balance").notNull().default(0),
    reconciliationFrequency: text("reconciliation_frequency", { enum: RECONCILIATION_FREQUENCIES }).notNull(),
    // docs/spec.md §R7: only BGFI épargne funds projects.
    fundsProjects: integer("funds_projects", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull(),
  },
  () => [
    check("accounts_type_check", sql.raw(inList("type", ACCOUNT_TYPES))),
    check("accounts_frequency_check", sql.raw(inList("reconciliation_frequency", RECONCILIATION_FREQUENCIES))),
    check("accounts_opening_balance_check", sql.raw(isInt("opening_balance"))),
    check("accounts_funds_projects_check", sql.raw(isBool("funds_projects"))),
    check("accounts_active_check", sql.raw(isBool("active"))),
  ],
);

// docs/spec.md §R4
export const envelopes = sqliteTable(
  "envelopes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    source: text("source", { enum: ENVELOPE_SOURCES }).notNull(),
  },
  () => [check("envelopes_source_check", sql.raw(inList("source", ENVELOPE_SOURCES)))],
);

// docs/spec.md §R2 (class), §R3 (rolls_over), §R4 (envelope)
export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    class: text("class", { enum: OPERATION_CLASSES }).notNull(),
    envelopeId: integer("envelope_id").references(() => envelopes.id),
    // docs/spec.md §R3: salary, savings and the monthly pot transfer roll over from day 25.
    rollsOver: integer("rolls_over", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  () => [
    check("categories_class_check", sql.raw(inList("class", OPERATION_CLASSES))),
    // Only expense categories belong to an envelope.
    check(
      "categories_envelope_check",
      sql.raw(`("class" = 'expense' AND "envelope_id" IS NOT NULL) OR ("class" <> 'expense' AND "envelope_id" IS NULL)`),
    ),
    check("categories_rolls_over_check", sql.raw(isBool("rolls_over"))),
    check("categories_active_check", sql.raw(isBool("active"))),
  ],
);

// docs/spec.md §R4: budgets are historized per month, per category.
export const budgets = sqliteTable(
  "budgets",
  {
    budgetMonth: text("budget_month").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    amount: integer("amount").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.budgetMonth, t.categoryId] }),
    check("budgets_month_check", sql.raw(isMonth("budget_month"))),
    check("budgets_amount_check", sql.raw(`${isInt("amount")} AND "amount" >= 0 AND "amount" <= ${MAX_SAFE_INTEGER}`)),
  ],
);

// docs/spec.md §R7
export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    ceiling: integer("ceiling"),
    dueDate: text("due_date"),
    status: text("status", { enum: PROJECT_STATUSES }).notNull().default("active"),
    note: text("note"),
  },
  () => [
    check("projects_status_check", sql.raw(inList("status", PROJECT_STATUSES))),
    check(
      "projects_ceiling_check",
      sql.raw(`"ceiling" IS NULL OR (${isInt("ceiling")} AND "ceiling" > 0 AND "ceiling" <= ${MAX_SAFE_INTEGER})`),
    ),
    check("projects_due_date_check", sql.raw(`"due_date" IS NULL OR ${isDate("due_date")}`)),
  ],
);

// docs/spec.md §R10
export const loans = sqliteTable(
  "loans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    person: text("person").notNull(),
    amount: integer("amount").notNull(),
    date: text("date").notNull(),
    status: text("status", { enum: LOAN_STATUSES }).notNull().default("open"),
  },
  () => [
    check("loans_amount_check", sql.raw(`${isInt("amount")} AND "amount" > 0 AND "amount" <= ${MAX_SAFE_INTEGER}`)),
    check("loans_date_check", sql.raw(isDate("date"))),
    check("loans_status_check", sql.raw(inList("status", LOAN_STATUSES))),
  ],
);

// docs/spec.md §Modèle de données "Règles de cohérence" — mirrors validateOperationShape in @suivi/shared.
const OPERATION_FIELD_MATRIX = [
  `("class" = 'revenue' AND "dest_account_id" IS NOT NULL AND "source_account_id" IS NULL AND "project_id" IS NULL AND "loan_id" IS NULL)`,
  `("class" = 'expense' AND "source_account_id" IS NOT NULL AND "dest_account_id" IS NULL AND "project_id" IS NULL AND "loan_id" IS NULL)`,
  `("class" = 'transfer' AND "source_account_id" IS NOT NULL AND "dest_account_id" IS NOT NULL AND "source_account_id" <> "dest_account_id" AND "loan_id" IS NULL)`,
  `("class" = 'savings' AND "source_account_id" IS NOT NULL AND "dest_account_id" IS NOT NULL AND "source_account_id" <> "dest_account_id" AND "project_id" IS NULL AND "loan_id" IS NULL)`,
  `("class" = 'project' AND "source_account_id" IS NOT NULL AND "project_id" IS NOT NULL AND "dest_account_id" IS NULL AND "loan_id" IS NULL)`,
  `("class" = 'loan' AND "source_account_id" IS NOT NULL AND "loan_id" IS NOT NULL AND "dest_account_id" IS NULL AND "project_id" IS NULL)`,
  `("class" = 'repayment' AND "dest_account_id" IS NOT NULL AND "loan_id" IS NOT NULL AND "source_account_id" IS NULL AND "project_id" IS NULL)`,
  `("class" = 'adjustment' AND ("source_account_id" IS NOT NULL) <> ("dest_account_id" IS NOT NULL) AND "project_id" IS NULL AND "loan_id" IS NULL)`,
].join(" OR ");

// docs/spec.md §Modèle de données: the central table. Soft delete only (deleted_at).
export const operations = sqliteTable(
  "operations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    budgetMonth: text("budget_month").notNull(),
    label: text("label"),
    amount: integer("amount").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    // Denormalized from the category; a trigger keeps it equal to categories.class.
    class: text("class", { enum: OPERATION_CLASSES }).notNull(),
    sourceAccountId: integer("source_account_id").references(() => accounts.id),
    destAccountId: integer("dest_account_id").references(() => accounts.id),
    projectId: integer("project_id").references(() => projects.id),
    client: text("client"),
    usage: text("usage", { enum: OPERATION_USAGES }),
    loanId: integer("loan_id").references(() => loans.id),
    status: text("status", { enum: OPERATION_STATUSES }).notNull().default("validated"),
    note: text("note"),
    // Import idempotency (P1.9), e.g. "xlsx-v9.3:row-5"; NULL for manual entries.
    sourceRef: text("source_ref").unique(),
    createdAt: text("created_at").notNull().default(nowUtc),
    updatedAt: text("updated_at").notNull().default(nowUtc),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    check("operations_date_check", sql.raw(isDate("date"))),
    check("operations_budget_month_check", sql.raw(isMonth("budget_month"))),
    check("operations_amount_check", sql.raw(`${isInt("amount")} AND "amount" > 0 AND "amount" <= ${MAX_SAFE_INTEGER}`)),
    check("operations_class_check", sql.raw(inList("class", OPERATION_CLASSES))),
    check("operations_usage_check", sql.raw(`"usage" IS NULL OR ${inList("usage", OPERATION_USAGES)}`)),
    check("operations_status_check", sql.raw(inList("status", OPERATION_STATUSES))),
    check("operations_field_matrix_check", sql.raw(OPERATION_FIELD_MATRIX)),
    index("operations_date_idx").on(t.date),
    index("operations_budget_month_idx").on(t.budgetMonth),
    index("operations_category_idx").on(t.categoryId),
    index("operations_source_account_idx").on(t.sourceAccountId),
    index("operations_dest_account_idx").on(t.destAccountId),
    index("operations_project_idx").on(t.projectId),
    index("operations_loan_idx").on(t.loanId),
  ],
);

// docs/spec.md §R12: history of balance checks.
export const reconciliations = sqliteTable(
  "reconciliations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    date: text("date").notNull(),
    actualBalance: integer("actual_balance").notNull(),
    theoreticalBalance: integer("theoretical_balance").notNull(),
    gap: integer("gap").notNull(),
    adjustmentOperationId: integer("adjustment_operation_id").references(() => operations.id),
  },
  (t) => [
    check("reconciliations_date_check", sql.raw(isDate("date"))),
    check(
      "reconciliations_integers_check",
      sql.raw(`${isInt("actual_balance")} AND ${isInt("theoretical_balance")} AND ${isInt("gap")}`),
    ),
    check("reconciliations_gap_check", sql.raw(`"gap" = "actual_balance" - "theoretical_balance"`)),
    index("reconciliations_account_date_idx").on(t.accountId, t.date),
  ],
);

// docs/spec.md §Modèle de données: parameters (savings target, rollover day, cash tolerance…).
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// docs/spec.md §Modèle de données journal_modifs: every edit or delete; append-only (triggers).
export const changeLog = sqliteTable("change_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableName: text("table_name").notNull(),
  rowId: integer("row_id").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  changedAt: text("changed_at").notNull().default(nowUtc),
});
