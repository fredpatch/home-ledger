import type { RequestHandler } from "express";
import type { ReferenceData } from "@suivi/shared";
import type { AppDatabase } from "../../db/connection.js";
import { getReferenceData } from "./reference.service.js";

export function referenceHandler(db: AppDatabase): RequestHandler {
  return (_req, res) => {
    const body: ReferenceData = getReferenceData(db);
    res.json(body);
  };
}
