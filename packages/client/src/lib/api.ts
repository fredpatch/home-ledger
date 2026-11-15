import type { ApiErrorBody, ApiErrorCode, ValidationIssue } from "@suivi/shared";

// Same-origin API client (P1.6 plan): the session cookie travels by itself, the CSRF token is added
// on every mutation (PROJECT.md §Security). Responses become typed results; nothing is thrown for HTTP errors.

export type ApiFailure =
  | { readonly kind: "unauthorized" }
  | { readonly kind: "validation"; readonly issues: readonly ValidationIssue[] }
  | { readonly kind: "conflict" }
  | { readonly kind: "not_found" }
  | { readonly kind: "error"; readonly code: ApiErrorCode | "network" };

export type ApiResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: ApiFailure };

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function isErrorBody(body: unknown): body is ApiErrorBody {
  return typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string";
}

/** Maps a non-2xx answer to a failure. Exported for tests. */
export function failureFrom(status: number, body: unknown): ApiFailure {
  const code: ApiErrorCode = isErrorBody(body) ? body.error : status >= 500 ? "internal_error" : "invalid_request";
  if (code === "auth_required") return { kind: "unauthorized" };
  if (code === "validation_failed") return { kind: "validation", issues: isErrorBody(body) ? (body.issues ?? []) : [] };
  if (code === "conflict") return { kind: "conflict" };
  if (code === "not_found") return { kind: "not_found" };
  // invalid_credentials (401 on login), too_many_attempts, csrf_invalid, origin_rejected, internal_error…
  return { kind: "error", code };
}

export interface ApiClient {
  get<T>(path: string): Promise<ApiResult<T>>;
  send<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<ApiResult<T>>;
  setCsrfToken(token: string | null): void;
}

export interface ApiClientOptions {
  readonly fetch?: typeof fetch;
  /** Called on any auth_required answer, so the app can show Connexion (docs/app-flow.md F1). */
  readonly onUnauthorized?: () => void;
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  let csrfToken: string | null = null;

  async function call<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (MUTATING.has(method) && csrfToken !== null) headers["X-CSRF-Token"] = csrfToken;
    let response: Response;
    try {
      response = await doFetch(path, {
        method,
        headers,
        credentials: "same-origin",
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return { ok: false, failure: { kind: "error", code: "network" } };
    }
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text === "" ? null : JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (response.ok) {
      return { ok: true, data: parsed as T };
    }
    const failure = failureFrom(response.status, parsed);
    if (failure.kind === "unauthorized") options.onUnauthorized?.();
    return { ok: false, failure };
  }

  return {
    get: (path) => call("GET", path),
    send: (method, path, body) => call(method, path, body),
    setCsrfToken: (token) => {
      csrfToken = token;
    },
  };
}

/** For TanStack Query: a failed result becomes a thrown ApiError. */
export class ApiError extends Error {
  constructor(readonly failure: ApiFailure) {
    super(failure.kind);
    this.name = "ApiError";
  }
}

export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new ApiError(result.failure);
  }
  return result.data;
}
