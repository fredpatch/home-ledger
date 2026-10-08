import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type OpenedDatabase } from "../../src/db/connection.js";
import { runMigrations } from "../../src/db/migrate.js";
import { seedReference } from "../../src/db/seed/seed-reference.js";
import { createApp } from "../../src/app.js";
import { setPasswordHash } from "../../src/modules/auth/auth.service.js";
import { hashPassword } from "../../src/modules/auth/password.js";

export interface TestDatabase extends OpenedDatabase {
  cleanup(): Promise<void>;
}

// Fresh migrated database in the OS temp dir. Never touches DATABASE_PATH.
export async function createTestDb(): Promise<TestDatabase> {
  const dir = await mkdtemp(join(tmpdir(), "suivi-test-"));
  const opened = openDatabase(join(dir, "test.db"));
  runMigrations(opened.db);
  return {
    ...opened,
    async cleanup() {
      opened.sqlite.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

// Returns the SQLite error message, or null when the statement succeeded.
export function sqlError(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

// --- Logged-in API harness (P1.5): fresh seeded database, synthetic password, injectable clock. ---

const API_ORIGIN = "http://localhost:5173";
const API_PASSWORD = "synthetic-pass-123";
let cachedApiHash: string | undefined;

// The body type is the caller's expectation of the contract (e.g. OperationWriteResponse, ApiErrorBody).
export interface ApiResponse<T> {
  readonly status: number;
  readonly body: T;
}

export interface ApiHarness {
  readonly testDb: TestDatabase;
  readonly csrfToken: string;
  /** Base URL, for requests made without the harness cookie. */
  readonly base: string;
  call<T = unknown>(method: string, path: string, body?: unknown, options?: { csrf?: boolean }): Promise<ApiResponse<T>>;
  idOf(table: "accounts" | "categories", name: string): number;
  count(table: string): number;
  close(): Promise<void>;
}

export async function startApi(): Promise<ApiHarness> {
  const testDb = await createTestDb();
  seedReference(testDb.db);
  cachedApiHash ??= await hashPassword(API_PASSWORD);
  setPasswordHash(testDb.db, cachedApiHash);
  const clock = () => new Date("2026-10-08T08:00:00.000Z");
  const server: Server = createApp({ db: testDb.db, config: { appOrigin: API_ORIGIN }, clock }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: API_ORIGIN },
    body: JSON.stringify({ password: API_PASSWORD, longSession: false }),
  });
  const token = /^__Host-sid=([^;]+);/.exec(login.headers.getSetCookie()[0] ?? "")?.[1] ?? "";
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  return {
    testDb,
    csrfToken,
    base,
    async call<T>(method: string, path: string, body?: unknown, options: { csrf?: boolean } = {}): Promise<ApiResponse<T>> {
      const headers: Record<string, string> = { Cookie: `__Host-sid=${token}`, Origin: API_ORIGIN };
      if (options.csrf ?? true) headers["X-CSRF-Token"] = csrfToken;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await response.text();
      const parsed: T = text === "" ? null : JSON.parse(text);
      return { status: response.status, body: parsed };
    },
    idOf(table, name) {
      return (testDb.sqlite.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name) as { id: number }).id;
    },
    count(table) {
      return (testDb.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await testDb.cleanup();
    },
  };
}
