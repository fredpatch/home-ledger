import { Router } from "express";
import type { AppDatabase } from "../../db/connection.js";
import { referenceHandler } from "./reference.controller.js";

// Mounted after requireSession and requireCsrf (PROJECT.md §Security). Read-only.
export function referenceRoutes(db: AppDatabase): Router {
  const router = Router();
  router.get("/reference", referenceHandler(db));
  return router;
}
