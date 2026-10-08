import { Router } from "express";
import type { Clock } from "../../config.js";
import type { AppDatabase } from "../../db/connection.js";
import { createHandler, deleteHandler, getHandler, listHandler, updateHandler } from "./operations.controller.js";

// Mounted after requireSession and requireCsrf (PROJECT.md §Security).
export function operationRoutes(db: AppDatabase, clock: Clock): Router {
  const router = Router();
  router.get("/operations", listHandler(db));
  router.post("/operations", createHandler(db, clock));
  router.get("/operations/:id", getHandler(db));
  router.patch("/operations/:id", updateHandler(db, clock));
  router.delete("/operations/:id", deleteHandler(db, clock));
  return router;
}
