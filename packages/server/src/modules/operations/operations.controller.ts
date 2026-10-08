import type { RequestHandler, Response } from "express";
import {
  parseCreateOperation,
  parseDeleteOperation,
  parseOperationListQuery,
  parseUpdateOperation,
  type Id,
  type OperationDeleteResponse,
  type OperationListResponse,
  type OperationWriteResponse,
} from "@suivi/shared";
import type { Clock } from "../../config.js";
import type { AppDatabase } from "../../db/connection.js";
import { sendError } from "../auth/auth.middleware.js";
import {
  createOperation,
  deleteOperation,
  getOperation,
  listOperations,
  OperationFailure,
  updateOperation,
} from "./operations.service.js";

// A malformed id cannot match a row: answer 404 like an unknown one.
function parseId(value: unknown): Id | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

// Runs a service call; typed failures become their HTTP answer, anything else goes to the error handler.
function respond(res: Response, run: () => void): void {
  try {
    run();
  } catch (error) {
    if (!(error instanceof OperationFailure)) {
      throw error;
    }
    sendError(res, error.status, error.error, error.issues);
  }
}

export function listHandler(db: AppDatabase): RequestHandler {
  return (req, res) => {
    const query = parseOperationListQuery(req.query);
    if (!query.ok) {
      sendError(res, 422, "validation_failed", query.issues);
      return;
    }
    const body: OperationListResponse = { items: listOperations(db, query.value) };
    res.json(body);
  };
}

export function getHandler(db: AppDatabase): RequestHandler {
  return (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      sendError(res, 404, "not_found");
      return;
    }
    respond(res, () => res.json(getOperation(db, id)));
  };
}

export function createHandler(db: AppDatabase, clock: Clock): RequestHandler {
  return (req, res) => {
    const request = parseCreateOperation(req.body);
    if (!request.ok) {
      sendError(res, 422, "validation_failed", request.issues);
      return;
    }
    respond(res, () => {
      const body: OperationWriteResponse = createOperation(db, clock, request.value);
      res.status(201).json(body);
    });
  };
}

export function updateHandler(db: AppDatabase, clock: Clock): RequestHandler {
  return (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      sendError(res, 404, "not_found");
      return;
    }
    const request = parseUpdateOperation(req.body);
    if (!request.ok) {
      sendError(res, 422, "validation_failed", request.issues);
      return;
    }
    respond(res, () => {
      const body: OperationWriteResponse = updateOperation(db, clock, id, request.value);
      res.json(body);
    });
  };
}

export function deleteHandler(db: AppDatabase, clock: Clock): RequestHandler {
  return (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      sendError(res, 404, "not_found");
      return;
    }
    const request = parseDeleteOperation(req.body);
    if (!request.ok) {
      sendError(res, 422, "validation_failed", request.issues);
      return;
    }
    respond(res, () => {
      const body: OperationDeleteResponse = { warnings: deleteOperation(db, clock, id, request.value.expectedUpdatedAt) };
      res.json(body);
    });
  };
}
