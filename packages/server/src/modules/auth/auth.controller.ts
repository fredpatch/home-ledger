import type { RequestHandler } from "express";
import { parseLoginRequest } from "@suivi/shared";
import type { Clock } from "../../config.js";
import type { AppDatabase } from "../../db/connection.js";
import { currentSession, sendError } from "./auth.middleware.js";
import { login, logout } from "./auth.service.js";
import { clearedSessionCookie, readCookie, SESSION_COOKIE, sessionCookie } from "./cookies.js";

export function loginHandler(db: AppDatabase, clock: Clock): RequestHandler {
  return async (req, res) => {
    const request = parseLoginRequest(req.body);
    if (request === null) {
      sendError(res, 400, "invalid_request");
      return;
    }
    const result = await login(db, clock, request, readCookie(req.headers.cookie, SESSION_COOKIE));
    if (!result.ok) {
      if (result.error === "too_many_attempts") {
        res.set("Retry-After", String(result.retryAfterSeconds));
        sendError(res, 429, "too_many_attempts");
      } else {
        sendError(res, 401, "invalid_credentials");
      }
      return;
    }
    res.set("Set-Cookie", sessionCookie(result.session.token, result.session.maxAgeSeconds));
    res.json(result.session.info);
  };
}

export const sessionHandler: RequestHandler = (_req, res) => {
  res.json(currentSession(res).info);
};

export function logoutHandler(db: AppDatabase): RequestHandler {
  return (_req, res) => {
    logout(db, currentSession(res).idHash);
    res.set("Set-Cookie", clearedSessionCookie());
    res.status(204).end();
  };
}
