// Authentication contract shared by the API and the client (PROJECT.md §Security).

import type { OperationIssueCode } from "./operation-rules.js";

// Stable API error codes; the client maps them to French messages (docs/app-flow.md F1).
export type ApiErrorCode =
  | "auth_required"
  | "invalid_credentials"
  | "too_many_attempts"
  | "csrf_invalid"
  | "origin_rejected"
  | "invalid_request"
  | "validation_failed"
  | "not_found"
  | "conflict"
  | "internal_error";

// Field-level reasons returned with validation_failed. Never carries the submitted value.
export type ValidationIssueCode =
  | OperationIssueCode
  | "required"
  | "invalid"
  | "too_long"
  | "unknown_field"
  | "invalid_date"
  | "invalid_budget_month"
  | "not_found"
  | "inactive"
  | "not_project_funding"
  | "exceeds_remaining"
  | "class_change_forbidden"
  | "has_repayments"
  | "read_only"
  | "out_of_range";

export interface ValidationIssue {
  readonly field: string;
  readonly code: ValidationIssueCode;
}

export interface ApiErrorBody {
  readonly error: ApiErrorCode;
  readonly issues?: readonly ValidationIssue[];
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

// short = desktop, long = phone (PROJECT.md §Security).
export const SESSION_KINDS = ["short", "long"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

// Upper bound so a huge body cannot make password hashing expensive.
export const PASSWORD_MAX_LENGTH = 1024;

export interface LoginRequest {
  readonly password: string;
  readonly longSession: boolean;
}

export interface SessionInfo {
  readonly csrfToken: string;
  readonly kind: SessionKind;
  // ISO 8601 UTC timestamp.
  readonly expiresAt: string;
}

// Returns the request when its shape is valid, otherwise null. Never echoes the password.
export function parseLoginRequest(body: unknown): LoginRequest | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const { password, longSession } = body as Record<string, unknown>;
  if (typeof password !== "string" || password.length === 0 || password.length > PASSWORD_MAX_LENGTH) {
    return null;
  }
  if (typeof longSession !== "boolean") {
    return null;
  }
  return { password, longSession };
}
