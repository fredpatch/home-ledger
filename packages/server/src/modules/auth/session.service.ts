import { createHash, randomBytes } from "node:crypto";
import { eq, lte, or } from "drizzle-orm";
import type { SessionInfo, SessionKind } from "@suivi/shared";
import type { AppDatabase } from "../../db/connection.js";
import { sessions } from "../../db/schema.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// PROJECT.md §Security + developer decision 2026-10-08: short (desktop) and long (phone) sessions.
export const SESSION_DURATIONS: Record<SessionKind, { readonly idleMs: number; readonly absoluteMs: number }> = {
  short: { idleMs: 12 * HOUR_MS, absoluteMs: 24 * HOUR_MS },
  long: { idleMs: 30 * DAY_MS, absoluteMs: 90 * DAY_MS },
};

// The sliding expiry is written at most once a minute, not on every request.
const SLIDE_INTERVAL_MS = 60 * 1000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface IssuedSession {
  // Raw session id: only ever sent in the cookie, never stored or logged.
  readonly token: string;
  readonly maxAgeSeconds: number;
  readonly info: SessionInfo;
}

export interface ActiveSession {
  readonly idHash: string;
  readonly info: SessionInfo;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createSession(db: AppDatabase, kind: SessionKind, now: Date): IssuedSession {
  const token = newToken();
  const csrfToken = newToken();
  const { idleMs, absoluteMs } = SESSION_DURATIONS[kind];
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + idleMs).toISOString();
  db.insert(sessions)
    .values({
      idHash: hashSessionToken(token),
      csrfToken,
      kind,
      createdAt: nowIso,
      lastSeenAt: nowIso,
      expiresAt,
      absoluteExpiresAt: new Date(now.getTime() + absoluteMs).toISOString(),
    })
    .run();
  return { token, maxAgeSeconds: absoluteMs / 1000, info: { csrfToken, kind, expiresAt } };
}

// Returns the live session for a cookie value, sliding its expiry; expired sessions are deleted.
export function resolveSession(db: AppDatabase, token: string, now: Date): ActiveSession | null {
  if (!TOKEN_PATTERN.test(token)) {
    return null;
  }
  const idHash = hashSessionToken(token);
  const row = db.select().from(sessions).where(eq(sessions.idHash, idHash)).get();
  if (row === undefined) {
    return null;
  }
  const nowMs = now.getTime();
  const idleExpiryMs = Date.parse(row.expiresAt);
  const absoluteMs = Date.parse(row.absoluteExpiresAt);
  // An unparseable timestamp (NaN) counts as expired: never fail open.
  if (!(nowMs < idleExpiryMs && nowMs < absoluteMs)) {
    deleteSession(db, idHash);
    return null;
  }
  let expiresAt = row.expiresAt;
  if (nowMs - Date.parse(row.lastSeenAt) >= SLIDE_INTERVAL_MS) {
    expiresAt = new Date(Math.min(nowMs + SESSION_DURATIONS[row.kind].idleMs, absoluteMs)).toISOString();
    db.update(sessions).set({ lastSeenAt: now.toISOString(), expiresAt }).where(eq(sessions.idHash, idHash)).run();
  }
  return { idHash, info: { csrfToken: row.csrfToken, kind: row.kind, expiresAt } };
}

export function deleteSession(db: AppDatabase, idHash: string): void {
  db.delete(sessions).where(eq(sessions.idHash, idHash)).run();
}

export function purgeExpiredSessions(db: AppDatabase, now: Date): void {
  const nowIso = now.toISOString();
  db.delete(sessions)
    .where(or(lte(sessions.expiresAt, nowIso), lte(sessions.absoluteExpiresAt, nowIso)))
    .run();
}

export function deleteAllSessions(db: AppDatabase): void {
  db.delete(sessions).run();
}
