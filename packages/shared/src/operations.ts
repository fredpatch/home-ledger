import type { ParseResult, ValidationIssue } from "./auth.js";
import { isValidBudgetMonth, isValidDate } from "./dates.js";
import { isValidAmount } from "./money.js";
import { isOperationClass, type OperationClass, type OperationStatus } from "./operation-class.js";
import type { Id } from "./operation-rules.js";
import type { PotWarning } from "./pot.js";
import { OPERATION_USAGES, type OperationUsage } from "./reference.js";

// Operations API contract (P1.5, docs/plans/P1.5.md). Amounts are positive integers in XAF,
// dates 'YYYY-MM-DD', budget months 'YYYY-MM'. The class always comes from the category (R2).

export interface OperationDto {
  readonly id: Id;
  readonly date: string;
  readonly budgetMonth: string;
  readonly label: string | null;
  readonly amount: number;
  readonly categoryId: Id;
  readonly class: OperationClass;
  readonly sourceAccountId: Id | null;
  readonly destAccountId: Id | null;
  readonly projectId: Id | null;
  readonly client: string | null;
  readonly usage: OperationUsage | null;
  readonly loanId: Id | null;
  readonly status: OperationStatus;
  readonly note: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OperationFields {
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
  /** Person the money is lent to, for a loan operation: its receivable is created with it (R10). */
  readonly loanPerson: string | null;
}

export interface CreateOperationRequest extends Partial<OperationFields> {
  readonly date: string;
  readonly amount: number;
  readonly categoryId: Id;
  /** Manual override of the R3 budget month. */
  readonly budgetMonth?: string;
}

export interface UpdateOperationRequest extends Partial<OperationFields> {
  /** Optimistic lock (P1.5 plan Q7): the updatedAt the client last read. */
  readonly expectedUpdatedAt: string;
  /** string = manual override, null = back to the computed month (Q9). */
  readonly budgetMonth?: string | null;
}

export interface DeleteOperationRequest {
  readonly expectedUpdatedAt: string;
}

export interface OperationWriteResponse {
  readonly operation: OperationDto;
  readonly warnings: readonly PotWarning[];
}

export interface OperationDeleteResponse {
  readonly warnings: readonly PotWarning[];
}

export interface OperationListQuery {
  readonly month?: string;
  readonly from?: string;
  readonly to?: string;
  readonly accountId?: Id;
  readonly categoryId?: Id;
  readonly class?: OperationClass;
  readonly limit: number;
  readonly offset: number;
}

export interface OperationListResponse {
  readonly items: readonly OperationDto[];
}

export const OPERATION_TEXT_LIMITS = { label: 200, note: 1000, client: 100, loanPerson: 100 } as const;
export const OPERATION_LIST_DEFAULT_LIMIT = 100;
export const OPERATION_LIST_MAX_LIMIT = 500;

type TextField = keyof typeof OPERATION_TEXT_LIMITS;
type LinkField = "sourceAccountId" | "destAccountId" | "projectId" | "loanId";
const TEXT_FIELDS: readonly string[] = ["label", "note", "client", "loanPerson"] satisfies TextField[];
const LINK_FIELDS: readonly string[] = ["sourceAccountId", "destAccountId", "projectId", "loanId"] satisfies LinkField[];
const CREATE_FIELDS = new Set<string>(["date", "amount", "budgetMonth", "usage", "categoryId", ...TEXT_FIELDS, ...LINK_FIELDS]);
const UPDATE_FIELDS = new Set<string>([...CREATE_FIELDS, "expectedUpdatedAt"]);

type Draft = { -readonly [K in keyof OperationFields]?: OperationFields[K] } & {
  budgetMonth?: string | null;
  expectedUpdatedAt?: string;
};

function isId(value: unknown): value is Id {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

function isUsage(value: unknown): value is OperationUsage {
  return typeof value === "string" && (OPERATION_USAGES as readonly string[]).includes(value);
}

/** Field-by-field shape check shared by create and update. Business rules run in the service. */
function parseFields(body: Record<string, unknown>, isUpdate: boolean, issues: ValidationIssue[]): Draft {
  const allowed = isUpdate ? UPDATE_FIELDS : CREATE_FIELDS;
  const draft: Draft = {};
  for (const [field, value] of Object.entries(body)) {
    if (!allowed.has(field)) {
      // Covers class, status, sourceRef, ids and timestamps: never set by the client (R2).
      issues.push({ field, code: "unknown_field" });
    } else if (field === "date") {
      if (isValidDate(value)) draft.date = value;
      else issues.push({ field, code: "invalid_date" });
    } else if (field === "amount") {
      if (isValidAmount(value)) draft.amount = value;
      else issues.push({ field, code: "invalid_amount" });
    } else if (field === "budgetMonth") {
      if (isValidBudgetMonth(value) || (isUpdate && value === null)) draft.budgetMonth = value;
      else issues.push({ field, code: "invalid_budget_month" });
    } else if (field === "usage") {
      if (value === null || isUsage(value)) draft.usage = value;
      else issues.push({ field, code: "invalid" });
    } else if (field === "categoryId") {
      if (isId(value)) draft.categoryId = value;
      else issues.push({ field, code: "invalid" });
    } else if (field === "expectedUpdatedAt") {
      if (typeof value === "string" && value.length > 0) draft.expectedUpdatedAt = value;
      else issues.push({ field, code: "invalid" });
    } else if (LINK_FIELDS.includes(field)) {
      if (value === null || isId(value)) draft[field as LinkField] = value;
      else issues.push({ field, code: "invalid" });
    } else {
      parseText(field as TextField, value, draft, issues);
    }
  }
  return draft;
}

// Text is trimmed; blank text is stored as null.
function parseText(field: TextField, value: unknown, draft: Draft, issues: ValidationIssue[]): void {
  if (value === null) {
    draft[field] = null;
  } else if (typeof value !== "string") {
    issues.push({ field, code: "invalid" });
  } else if (value.length > OPERATION_TEXT_LIMITS[field]) {
    issues.push({ field, code: "too_long" });
  } else {
    draft[field] = value.trim() === "" ? null : value.trim();
  }
}

export function parseCreateOperation(body: unknown): ParseResult<CreateOperationRequest> {
  if (!isObject(body)) {
    return { ok: false, issues: [{ field: "body", code: "invalid" }] };
  }
  const issues: ValidationIssue[] = [];
  const { budgetMonth, ...draft } = parseFields(body, false, issues);
  for (const field of ["date", "amount", "categoryId"]) {
    if (!(field in body)) {
      issues.push({ field, code: "required" });
    }
  }
  const { date, amount, categoryId } = draft;
  if (issues.length > 0 || date === undefined || amount === undefined || categoryId === undefined) {
    return { ok: false, issues };
  }
  return { ok: true, value: { ...draft, date, amount, categoryId, budgetMonth: budgetMonth ?? undefined } };
}

export function parseUpdateOperation(body: unknown): ParseResult<UpdateOperationRequest> {
  if (!isObject(body)) {
    return { ok: false, issues: [{ field: "body", code: "invalid" }] };
  }
  const issues: ValidationIssue[] = [];
  const { expectedUpdatedAt, ...draft } = parseFields(body, true, issues);
  if (!("expectedUpdatedAt" in body)) {
    issues.push({ field: "expectedUpdatedAt", code: "required" });
  }
  if (issues.length > 0 || expectedUpdatedAt === undefined) {
    return { ok: false, issues };
  }
  return { ok: true, value: { ...draft, expectedUpdatedAt } };
}

export function parseDeleteOperation(body: unknown): ParseResult<DeleteOperationRequest> {
  if (!isObject(body)) {
    return { ok: false, issues: [{ field: "expectedUpdatedAt", code: "required" }] };
  }
  const issues: ValidationIssue[] = [];
  for (const field of Object.keys(body)) {
    if (field !== "expectedUpdatedAt") {
      issues.push({ field, code: "unknown_field" });
    }
  }
  const expected = body.expectedUpdatedAt;
  if (expected === undefined) {
    issues.push({ field: "expectedUpdatedAt", code: "required" });
  } else if (typeof expected !== "string" || expected.length === 0) {
    issues.push({ field: "expectedUpdatedAt", code: "invalid" });
  }
  if (issues.length > 0 || typeof expected !== "string") {
    return { ok: false, issues };
  }
  return { ok: true, value: { expectedUpdatedAt: expected } };
}

const QUERY_FIELDS = new Set(["month", "from", "to", "accountId", "categoryId", "class", "limit", "offset"]);

function parseQueryInt(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

export function parseOperationListQuery(query: Record<string, unknown>): ParseResult<OperationListQuery> {
  const issues: ValidationIssue[] = [];
  const out: { -readonly [K in keyof OperationListQuery]: OperationListQuery[K] } = {
    limit: OPERATION_LIST_DEFAULT_LIMIT,
    offset: 0,
  };
  for (const [field, value] of Object.entries(query)) {
    if (!QUERY_FIELDS.has(field)) {
      issues.push({ field, code: "unknown_field" });
      continue;
    }
    if (typeof value !== "string") {
      issues.push({ field, code: "invalid" });
      continue;
    }
    const id = parseQueryInt(value, 1, Number.MAX_SAFE_INTEGER);
    let valid = true;
    if (field === "month" && isValidBudgetMonth(value)) out.month = value;
    else if ((field === "from" || field === "to") && isValidDate(value)) out[field] = value;
    else if (field === "class" && isOperationClass(value)) out.class = value;
    else if ((field === "accountId" || field === "categoryId") && id !== null) out[field] = id;
    else if (field === "limit" && id !== null && id <= OPERATION_LIST_MAX_LIMIT) out.limit = id;
    else if (field === "offset" && parseQueryInt(value, 0, Number.MAX_SAFE_INTEGER) !== null) out.offset = Number(value);
    else valid = false;
    if (!valid) {
      issues.push({ field, code: "invalid" });
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: out };
}
