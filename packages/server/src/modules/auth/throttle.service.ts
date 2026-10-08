import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db/connection.js";
import { authThrottle } from "../../db/schema.js";

const MINUTE_MS = 60 * 1000;

// Developer decision 2026-10-08: one global counter (single account; every request reaches the
// server from 127.0.0.1 behind tailscale serve), stored in the database so a restart does not reset it.
export const THROTTLE_POLICY = { maxFailures: 5, windowMs: 15 * MINUTE_MS, lockMs: 15 * MINUTE_MS } as const;

const THROTTLE_ID = 1;

export type AttemptReservation =
  | { readonly allowed: true; readonly locksOnFailure: boolean }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

// Counts the attempt before the password is checked, so parallel requests cannot exceed the limit.
// better-sqlite3 is synchronous: the read-modify-write cannot interleave with another request.
export function reserveLoginAttempt(db: AppDatabase, now: Date): AttemptReservation {
  return db.transaction((tx) => {
    const nowMs = now.getTime();
    const row = tx.select().from(authThrottle).where(eq(authThrottle.id, THROTTLE_ID)).get();
    if (row?.lockedUntil != null && nowMs < Date.parse(row.lockedUntil)) {
      return { allowed: false, retryAfterSeconds: Math.ceil((Date.parse(row.lockedUntil) - nowMs) / 1000) };
    }
    const windowOpen =
      row?.windowStartedAt != null &&
      row.lockedUntil == null &&
      nowMs - Date.parse(row.windowStartedAt) < THROTTLE_POLICY.windowMs;
    const failedCount = (windowOpen ? row.failedCount : 0) + 1;
    const windowStartedAt = windowOpen ? row.windowStartedAt : now.toISOString();
    const locksOnFailure = failedCount >= THROTTLE_POLICY.maxFailures;
    const lockedUntil = locksOnFailure ? new Date(nowMs + THROTTLE_POLICY.lockMs).toISOString() : null;
    tx.insert(authThrottle)
      .values({ id: THROTTLE_ID, failedCount, windowStartedAt, lockedUntil })
      .onConflictDoUpdate({ target: authThrottle.id, set: { failedCount, windowStartedAt, lockedUntil } })
      .run();
    return { allowed: true, locksOnFailure };
  });
}

export function resetThrottle(db: AppDatabase): void {
  db.delete(authThrottle).where(eq(authThrottle.id, THROTTLE_ID)).run();
}
