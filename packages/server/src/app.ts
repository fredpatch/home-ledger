import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { systemClock, type AppConfig, type Clock } from "./config.js";
import type { AppDatabase } from "./db/connection.js";
import { requireCsrf, requireOrigin, requireSession, sendError } from "./modules/auth/auth.middleware.js";
import { protectedAuthRoutes, publicAuthRoutes } from "./modules/auth/auth.routes.js";
import { operationRoutes } from "./modules/operations/operations.routes.js";
import { settingsRoutes } from "./modules/settings/settings.routes.js";

export interface AppDependencies {
  readonly db: AppDatabase;
  readonly config: AppConfig;
  readonly clock?: Clock;
}

const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

// Client errors (malformed JSON, body too large) are not logged: their message can quote the body.
// Server errors log the error name and message only.
const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    sendError(res, 400, "invalid_request");
    return;
  }
  console.error("server error:", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
  sendError(res, 500, "internal_error");
};

export function createApp({ db, config, clock = systemClock }: AppDependencies): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // PROJECT.md §Security: every /api route except /api/auth/login requires a session.
  const api = express.Router();
  api.use(noStore);
  api.use(requireOrigin(config));
  api.use(express.json({ limit: "10kb" }));
  api.use(publicAuthRoutes(db, clock));
  api.use(requireSession(db, clock));
  api.use(requireCsrf);
  api.use(protectedAuthRoutes(db));
  api.use(operationRoutes(db, clock));
  api.use(settingsRoutes(db));
  api.use((_req, res) => {
    sendError(res, 404, "not_found");
  });
  app.use("/api", api);

  app.use(errorHandler);
  return app;
}
