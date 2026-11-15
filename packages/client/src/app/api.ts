import { QueryClient } from "@tanstack/react-query";
import type { AppSettings, ReferenceData, SessionInfo } from "@suivi/shared";
import { ApiError, createApiClient, unwrap } from "../lib/api.js";

export const SESSION_KEY = ["session"] as const;
export const REFERENCE_KEY = ["reference"] as const;
export const SETTINGS_KEY = ["settings"] as const;
export const OPERATIONS_KEY = ["operations"] as const;

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

// docs/app-flow.md F1: any auth_required answer drops the session, so Connexion is shown.
export const api = createApiClient({
  onUnauthorized: () => {
    api.setCsrfToken(null);
    queryClient.setQueryData(SESSION_KEY, null);
  },
});

/** The current session, or null when signed out. The CSRF token is kept in memory only. */
export async function fetchSession(): Promise<SessionInfo | null> {
  const result = await api.get<SessionInfo>("/api/auth/session");
  if (result.ok) {
    api.setCsrfToken(result.data.csrfToken);
    return result.data;
  }
  if (result.failure.kind === "unauthorized") {
    return null;
  }
  throw new ApiError(result.failure);
}

export function signedIn(session: SessionInfo): void {
  api.setCsrfToken(session.csrfToken);
  queryClient.setQueryData(SESSION_KEY, session);
}

export function signedOut(): void {
  api.setCsrfToken(null);
  queryClient.clear();
  queryClient.setQueryData(SESSION_KEY, null);
}

export async function fetchReference(): Promise<ReferenceData> {
  return unwrap(await api.get<ReferenceData>("/api/reference"));
}

export async function fetchSettings(): Promise<AppSettings> {
  return unwrap(await api.get<AppSettings>("/api/settings"));
}
