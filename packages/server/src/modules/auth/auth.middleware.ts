import { timingSafeEqual } from "node:crypto";
import type { RequestHandler, Response } from "express";
import type { ApiErrorCode } from "@suivi/shared";
import type { AppConfig, Clock } from "../../config.js";
import type { AppDatabase } from "../../db/connection.js";
import { readCookie, SESSION_COOKIE } from "./cookies.js";
import { resolveSession, type ActiveSession } from "./session.service.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function sendError(res: Response, status: number, error: ApiErrorCode): void {
  res.status(status).json({ error });
}

export function currentSession(res: Response): ActiveSession {
  return res.locals.session as ActiveSession;
}

// PROJECT.md §Security: every mutation, login included, must come from APP_ORIGIN exactly.
export function requireOrigin(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    if (MUTATING_METHODS.has(req.method) && req.get("origin") !== config.appOrigin) {
      sendError(res, 403, "origin_rejected");
      return;
    }
    next();
  };
}

// Default deny: everything mounted after this needs a live session.
export function requireSession(db: AppDatabase, clock: Clock): RequestHandler {
  return (req, res, next) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const session = token === null ? null : resolveSession(db, token, clock());
    if (session === null) {
      sendError(res, 401, "auth_required");
      return;
    }
    res.locals.session = session;
    next();
  };
}

// Synchronizer token: the session's CSRF token must come back in X-CSRF-Token on every mutation.
export const requireCsrf: RequestHandler = (req, res, next) => {
  if (MUTATING_METHODS.has(req.method) && !sameToken(req.get("x-csrf-token"), currentSession(res).info.csrfToken)) {
    sendError(res, 403, "csrf_invalid");
    return;
  }
  next();
};

function sameToken(received: string | undefined, expected: string): boolean {
  if (received === undefined) {
    return false;
  }
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
