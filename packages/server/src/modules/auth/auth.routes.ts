import { Router } from "express";
import type { Clock } from "../../config.js";
import type { AppDatabase } from "../../db/connection.js";
import { loginHandler, logoutHandler, sessionHandler } from "./auth.controller.js";

// Mounted before requireSession: the only public API route.
export function publicAuthRoutes(db: AppDatabase, clock: Clock): Router {
  const router = Router();
  router.post("/auth/login", loginHandler(db, clock));
  return router;
}

// Mounted after requireSession and requireCsrf.
export function protectedAuthRoutes(db: AppDatabase): Router {
  const router = Router();
  router.get("/auth/session", sessionHandler);
  router.post("/auth/logout", logoutHandler(db));
  return router;
}
