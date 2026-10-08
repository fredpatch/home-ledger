import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test, type TestContext } from "node:test";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app.js";
import { sessions, settings } from "../../src/db/schema.js";
import { PASSWORD_HASH_SETTING, setPasswordHash } from "../../src/modules/auth/auth.service.js";
import { hashPassword } from "../../src/modules/auth/password.js";
import { createTestDb, type TestDatabase } from "./helpers.js";

// Synthetic credentials only.
const ORIGIN = "http://localhost:5173";
const PASSWORD = "synthetic-pass-123";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

let cachedHash: string | undefined;

interface Harness {
  readonly testDb: TestDatabase;
  url(path: string): string;
  advance(ms: number): void;
  restart(): Promise<void>;
  close(): Promise<void>;
}

async function startHarness(options: { withPassword?: boolean } = {}): Promise<Harness> {
  const testDb = await createTestDb();
  if (options.withPassword ?? true) {
    cachedHash ??= await hashPassword(PASSWORD);
    setPasswordHash(testDb.db, cachedHash);
  }
  let nowMs = Date.parse("2026-10-08T08:00:00.000Z");
  const clock = () => new Date(nowMs);
  let server: Server;
  const listen = async () => {
    server = createApp({ db: testDb.db, config: { appOrigin: ORIGIN }, clock }).listen(0, "127.0.0.1");
    await once(server, "listening");
  };
  const stop = () => new Promise<void>((resolve) => server.close(() => resolve()));
  await listen();
  return {
    testDb,
    url: (path) => `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`,
    advance: (ms) => {
      nowMs += ms;
    },
    restart: async () => {
      await stop();
      await listen();
    },
    close: async () => {
      await stop();
      await testDb.cleanup();
    },
  };
}

function login(h: Harness, password: string, longSession = false, headers: Record<string, string> = {}) {
  return fetch(h.url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: JSON.stringify({ password, longSession }),
  });
}

interface LoggedIn {
  readonly token: string;
  readonly csrfToken: string;
  readonly expiresAt: string;
  readonly kind: string;
}

async function loginOk(h: Harness, longSession = false, headers: Record<string, string> = {}): Promise<LoggedIn> {
  const response = await login(h, PASSWORD, longSession, headers);
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie()[0] ?? "";
  const token = /^__Host-sid=([^;]+);/.exec(cookie)?.[1];
  assert.ok(token);
  const body = (await response.json()) as { csrfToken: string; expiresAt: string; kind: string };
  return { token, ...body };
}

function getSession(h: Harness, token: string) {
  return fetch(h.url("/api/auth/session"), { headers: { Cookie: `__Host-sid=${token}` } });
}

function logout(h: Harness, token: string, headers: Record<string, string>) {
  return fetch(h.url("/api/auth/logout"), { method: "POST", headers: { Cookie: `__Host-sid=${token}`, ...headers } });
}

function sessionCount(h: Harness): number {
  return h.testDb.db.select().from(sessions).all().length;
}

async function withHarness(t: TestContext, options: { withPassword?: boolean } = {}): Promise<Harness> {
  const h = await startHarness(options);
  t.after(() => h.close());
  // Silence auth log lines in test output.
  for (const method of ["info", "warn", "error"] as const) {
    t.mock.method(console, method, () => undefined);
  }
  return h;
}

test("default deny: /api needs a session, /health does not", async (t) => {
  const h = await withHarness(t);
  assert.equal((await fetch(h.url("/health"))).status, 200);
  for (const path of ["/api/auth/session", "/api/anything"]) {
    const response = await fetch(h.url(path));
    assert.equal(response.status, 401, path);
    assert.deepEqual(await response.json(), { error: "auth_required" });
  }
  const post = await fetch(h.url("/api/anything"), { method: "POST", headers: { Origin: ORIGIN } });
  assert.equal(post.status, 401);
  assert.equal((await getSession(h, "A".repeat(43))).status, 401);
});

test("login: correct password issues a hashed session and a __Host- cookie", async (t) => {
  const h = await withHarness(t);
  const response = await login(h, PASSWORD);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const cookie = response.headers.getSetCookie()[0] ?? "";
  const parts = cookie.split("; ");
  for (const attribute of ["Path=/", "HttpOnly", "Secure", "SameSite=Strict", `Max-Age=${24 * 3600}`]) {
    assert.ok(parts.includes(attribute), attribute);
  }
  assert.doesNotMatch(cookie, /Domain=/i);
  const token = /^__Host-sid=([A-Za-z0-9_-]{43});/.exec(cookie)?.[1];
  assert.ok(token);
  const body = (await response.json()) as { csrfToken: string; kind: string; expiresAt: string };
  assert.equal(body.kind, "short");
  assert.equal(body.expiresAt, "2026-10-08T20:00:00.000Z");
  assert.match(body.csrfToken, /^[A-Za-z0-9_-]{43}$/);

  const rows = h.testDb.db.select().from(sessions).all();
  assert.equal(rows.length, 1);
  assert.match(rows[0]?.idHash ?? "", /^[0-9a-f]{64}$/);
  assert.notEqual(rows[0]?.idHash, token);

  const session = await getSession(h, token);
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), body);
});

test("login: wrong password, missing password and bad bodies", async (t) => {
  const h = await withHarness(t);
  const wrong = await login(h, "not-the-password");
  assert.equal(wrong.status, 401);
  assert.deepEqual(await wrong.json(), { error: "invalid_credentials" });
  assert.equal(wrong.headers.getSetCookie().length, 0);

  const malformed = await fetch(h.url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: `{"password":"${PASSWORD}"`,
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "invalid_request" });

  const tooLarge = await fetch(h.url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ password: "x".repeat(20_000), longSession: false }),
  });
  assert.equal(tooLarge.status, 400);

  const missingFlag = await fetch(h.url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert.equal(missingFlag.status, 400);
});

test("login: no configured password is rejected like a wrong password", async (t) => {
  const h = await withHarness(t, { withPassword: false });
  const response = await login(h, PASSWORD);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "invalid_credentials" });
});

test("throttle: 5 failures lock even the right password, across a restart, for 15 minutes", async (t) => {
  const h = await withHarness(t);
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await login(h, "wrong-password")).status, 401);
  }
  const locked = await login(h, PASSWORD);
  assert.equal(locked.status, 429);
  assert.equal(locked.headers.get("retry-after"), "900");
  assert.deepEqual(await locked.json(), { error: "too_many_attempts" });

  await h.restart();
  assert.equal((await login(h, PASSWORD)).status, 429);

  h.advance(15 * 60_000 - 1000);
  const almost = await login(h, PASSWORD);
  assert.equal(almost.status, 429);
  assert.equal(almost.headers.get("retry-after"), "1");

  h.advance(1000);
  assert.equal((await login(h, PASSWORD)).status, 200);
});

test("throttle: a success resets the counter; failures outside the window start a new one", async (t) => {
  const h = await withHarness(t);
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal((await login(h, "wrong-password")).status, 401);
  }
  await loginOk(h);
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal((await login(h, "wrong-password")).status, 401);
  }
  h.advance(15 * 60_000);
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal((await login(h, "wrong-password")).status, 401);
  }
  assert.equal((await login(h, PASSWORD)).status, 200);
});

test("throttle: parallel attempts cannot exceed the limit", async (t) => {
  const h = await withHarness(t);
  const responses = await Promise.all(Array.from({ length: 8 }, () => login(h, "wrong-password")));
  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429, 429, 429]);
});

test("origin: login and logout require the exact APP_ORIGIN", async (t) => {
  const h = await withHarness(t);
  for (const headers of [{ Origin: "https://evil.example" }, { Origin: `${ORIGIN}/` }, { Origin: "null" }]) {
    const response = await login(h, PASSWORD, false, headers);
    assert.equal(response.status, 403, headers.Origin);
    assert.deepEqual(await response.json(), { error: "origin_rejected" });
  }
  const noOrigin = await fetch(h.url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PASSWORD, longSession: false }),
  });
  assert.equal(noOrigin.status, 403);
  assert.equal(sessionCount(h), 0);

  const { token, csrfToken } = await loginOk(h);
  const response = await logout(h, token, { Origin: "https://evil.example", "X-CSRF-Token": csrfToken });
  assert.equal(response.status, 403);
  assert.equal(sessionCount(h), 1);
});

test("csrf: logout needs the session's token; logout deletes the session", async (t) => {
  const h = await withHarness(t);
  const { token, csrfToken } = await loginOk(h);
  const missing = await logout(h, token, { Origin: ORIGIN });
  assert.equal(missing.status, 403);
  assert.deepEqual(await missing.json(), { error: "csrf_invalid" });
  assert.equal((await logout(h, token, { Origin: ORIGIN, "X-CSRF-Token": "A".repeat(43) })).status, 403);
  assert.equal((await logout(h, token, { Origin: ORIGIN, "X-CSRF-Token": csrfToken.slice(1) })).status, 403);
  assert.equal(sessionCount(h), 1);

  const ok = await logout(h, token, { Origin: ORIGIN, "X-CSRF-Token": csrfToken });
  assert.equal(ok.status, 204);
  assert.match(ok.headers.getSetCookie()[0] ?? "", /^__Host-sid=; .*Max-Age=0$/);
  assert.equal(sessionCount(h), 0);
  assert.equal((await getSession(h, token)).status, 401);
});

test("csrf: a token from another session is rejected", async (t) => {
  const h = await withHarness(t);
  const first = await loginOk(h);
  const second = await loginOk(h);
  assert.equal((await logout(h, second.token, { Origin: ORIGIN, "X-CSRF-Token": first.csrfToken })).status, 403);
});

test("short session: expires after 12 h idle and at 24 h even when active", async (t) => {
  const h = await withHarness(t);
  const idle = await loginOk(h);
  h.advance(12 * HOUR_MS - 1);
  assert.equal((await getSession(h, idle.token)).status, 200);
  h.advance(12 * HOUR_MS);
  assert.equal((await getSession(h, idle.token)).status, 401);
  assert.equal(sessionCount(h), 0);

  const active = await loginOk(h);
  for (let elapsed = 0; elapsed < 22; elapsed += 11) {
    h.advance(11 * HOUR_MS);
    const response = await getSession(h, active.token);
    assert.equal(response.status, 200);
  }
  h.advance(2 * HOUR_MS);
  assert.equal((await getSession(h, active.token)).status, 401);
});

test("long session: 30 days idle, 90 days absolute", async (t) => {
  const h = await withHarness(t);
  const idle = await loginOk(h, true);
  assert.equal(idle.kind, "long");
  h.advance(30 * DAY_MS);
  assert.equal((await getSession(h, idle.token)).status, 401);

  const active = await loginOk(h, true);
  for (let elapsed = 0; elapsed < 87; elapsed += 29) {
    h.advance(29 * DAY_MS);
    assert.equal((await getSession(h, active.token)).status, 200, `day ${elapsed + 29}`);
  }
  h.advance(3 * DAY_MS);
  assert.equal((await getSession(h, active.token)).status, 401);
});

test("login: renews the session id and purges expired sessions", async (t) => {
  const h = await withHarness(t);
  const stale = await loginOk(h);
  h.advance(13 * HOUR_MS);
  const old = await loginOk(h);
  // The stale session was purged by the second login.
  assert.equal(sessionCount(h), 1);

  const renewed = await loginOk(h, false, { Cookie: `__Host-sid=${old.token}` });
  assert.notEqual(renewed.token, old.token);
  assert.equal(sessionCount(h), 1);
  assert.equal((await getSession(h, old.token)).status, 401);
  assert.equal((await getSession(h, stale.token)).status, 401);
  assert.equal((await getSession(h, renewed.token)).status, 200);
});

test("set password: replaces the hash, revokes every session and clears the lock", async (t) => {
  const h = await withHarness(t);
  const { token } = await loginOk(h);
  for (let attempt = 0; attempt < 5; attempt++) {
    await login(h, "wrong-password");
  }
  assert.equal((await login(h, PASSWORD)).status, 429);

  const newPassword = "another-synthetic-pass";
  setPasswordHash(h.testDb.db, await hashPassword(newPassword));
  const stored = h.testDb.db.select().from(settings).where(eq(settings.key, PASSWORD_HASH_SETTING)).get();
  assert.match(stored?.value ?? "", /^\$argon2id\$/);
  assert.equal(sessionCount(h), 0);
  assert.equal((await getSession(h, token)).status, 401);
  assert.equal((await login(h, PASSWORD)).status, 401);
  assert.equal((await login(h, newPassword)).status, 200);
});

test("logs: no password, hash, session id or CSRF token is ever written", async (t) => {
  const h = await startHarness();
  t.after(() => h.close());
  const lines: string[] = [];
  for (const method of ["log", "info", "warn", "error"] as const) {
    t.mock.method(console, method, (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
  }
  await fetch(h.url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: `{"password":"${PASSWORD}"`,
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    await login(h, `${PASSWORD}-wrong`);
  }
  h.advance(15 * 60_000);
  const { token, csrfToken } = await loginOk(h, true);
  await logout(h, token, { Origin: ORIGIN, "X-CSRF-Token": csrfToken });

  const hash = h.testDb.db.select().from(settings).where(eq(settings.key, PASSWORD_HASH_SETTING)).get()?.value;
  assert.ok(hash);
  assert.ok(lines.includes("auth: login failed"));
  assert.ok(lines.includes("auth: locked"));
  assert.ok(lines.includes("auth: login ok (long)"));
  assert.ok(lines.includes("auth: logout"));
  const output = lines.join("\n");
  for (const secret of [PASSWORD, hash, token, csrfToken]) {
    assert.equal(output.includes(secret), false);
  }
});
