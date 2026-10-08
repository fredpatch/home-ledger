import { Router } from "express";
import type { AppDatabase } from "../../db/connection.js";
import { getSettingsHandler, patchSettingsHandler } from "./settings.controller.js";

// Mounted after requireSession and requireCsrf (PROJECT.md §Security).
export function settingsRoutes(db: AppDatabase): Router {
  const router = Router();
  router.get("/settings", getSettingsHandler(db));
  router.patch("/settings", patchSettingsHandler(db));
  return router;
}
