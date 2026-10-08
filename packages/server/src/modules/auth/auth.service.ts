import { eq } from "drizzle-orm";
import type { LoginRequest } from "@suivi/shared";
import type { Clock } from "../../config.js";
import type { AppDatabase } from "../../db/connection.js";
import { settings } from "../../db/schema.js";
import { verifyPassword } from "./password.js";
import {
  createSession,
  deleteAllSessions,
  deleteSession,
  hashSessionToken,
  purgeExpiredSessions,
  type IssuedSession,
} from "./session.service.js";
import { reserveLoginAttempt, resetThrottle } from "./throttle.service.js";

// Developer decision 2026-10-08: the argon2id hash lives in settings. Any settings API must never return it.
export const PASSWORD_HASH_SETTING = "auth_password_hash";

export type LoginResult =
  | { readonly ok: true; readonly session: IssuedSession }
  | { readonly ok: false; readonly error: "invalid_credentials" }
  | { readonly ok: false; readonly error: "too_many_attempts"; readonly retryAfterSeconds: number };

// Log lines carry no IP, password, hash, session id or token (PROJECT.md §Security).
export async function login(
  db: AppDatabase,
  clock: Clock,
  request: LoginRequest,
  presentedToken: string | null,
): Promise<LoginResult> {
  const reservation = reserveLoginAttempt(db, clock());
  if (!reservation.allowed) {
    console.warn("auth: login refused (locked)");
    return { ok: false, error: "too_many_attempts", retryAfterSeconds: reservation.retryAfterSeconds };
  }
  const encodedHash = readPasswordHash(db);
  if (encodedHash === null) {
    console.warn("auth: no password configured");
  }
  const valid = encodedHash !== null && (await verifyPassword(encodedHash, request.password));
  if (!valid) {
    console.info("auth: login failed");
    if (reservation.locksOnFailure) {
      console.warn("auth: locked");
    }
    return { ok: false, error: "invalid_credentials" };
  }
  const kind = request.longSession ? "long" : "short";
  const session = db.transaction((tx) => {
    const now = clock();
    resetThrottle(tx);
    // A new id at every login (session fixation).
    if (presentedToken !== null) {
      deleteSession(tx, hashSessionToken(presentedToken));
    }
    purgeExpiredSessions(tx, now);
    return createSession(tx, kind, now);
  });
  console.info(`auth: login ok (${kind})`);
  return { ok: true, session };
}

export function logout(db: AppDatabase, idHash: string): void {
  deleteSession(db, idHash);
  console.info("auth: logout");
}

// Used by the auth:set-password CLI: replaces the hash and revokes every session.
export function setPasswordHash(db: AppDatabase, encodedHash: string): void {
  db.transaction((tx) => {
    tx.insert(settings)
      .values({ key: PASSWORD_HASH_SETTING, value: encodedHash })
      .onConflictDoUpdate({ target: settings.key, set: { value: encodedHash } })
      .run();
    deleteAllSessions(tx);
    resetThrottle(tx);
  });
}

function readPasswordHash(db: AppDatabase): string | null {
  const row = db.select().from(settings).where(eq(settings.key, PASSWORD_HASH_SETTING)).get();
  return row?.value ?? null;
}
