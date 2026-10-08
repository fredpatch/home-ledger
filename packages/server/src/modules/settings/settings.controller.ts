import type { RequestHandler } from "express";
import { parseSettingsPatch, type AppSettings } from "@suivi/shared";
import type { AppDatabase } from "../../db/connection.js";
import { sendError } from "../auth/auth.middleware.js";
import { readSettings, updateSettings } from "./settings.service.js";

export function getSettingsHandler(db: AppDatabase): RequestHandler {
  return (_req, res) => {
    const body: AppSettings = readSettings(db);
    res.json(body);
  };
}

export function patchSettingsHandler(db: AppDatabase): RequestHandler {
  return (req, res) => {
    const patch = parseSettingsPatch(req.body);
    if (!patch.ok) {
      sendError(res, 422, "validation_failed", patch.issues);
      return;
    }
    const body: AppSettings = updateSettings(db, patch.value);
    res.json(body);
  };
}
