// Authentication contract shared by the API and the client (PROJECT.md §Security).

// Stable API error codes; the client maps them to French messages (docs/app-flow.md F1).
export type ApiErrorCode =
  | "auth_required"
  | "invalid_credentials"
  | "too_many_attempts"
  | "csrf_invalid"
  | "origin_rejected"
  | "invalid_request"
  | "not_found"
  | "internal_error";

export interface ApiErrorBody {
  readonly error: ApiErrorCode;
}

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
