import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createApiClient, failureFrom, unwrap } from "../src/lib/api.js";

interface Seen {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(status: number, body: unknown, seen: Seen[] = []): typeof fetch {
  return async (input, init) => {
    seen.push({ url: String(input), init });
    return new Response(body === undefined ? "" : JSON.stringify(body), { status });
  };
}

test("failureFrom maps status and error codes to typed failures", () => {
  assert.deepEqual(failureFrom(401, { error: "auth_required" }), { kind: "unauthorized" });
  assert.deepEqual(failureFrom(401, { error: "invalid_credentials" }), { kind: "error", code: "invalid_credentials" });
  assert.deepEqual(failureFrom(403, { error: "csrf_invalid" }), { kind: "error", code: "csrf_invalid" });
  assert.deepEqual(failureFrom(409, { error: "conflict" }), { kind: "conflict" });
  assert.deepEqual(failureFrom(404, { error: "not_found" }), { kind: "not_found" });
  assert.deepEqual(failureFrom(429, { error: "too_many_attempts" }), { kind: "error", code: "too_many_attempts" });
  assert.deepEqual(failureFrom(422, { error: "validation_failed", issues: [{ field: "amount", code: "invalid_amount" }] }), {
    kind: "validation",
    issues: [{ field: "amount", code: "invalid_amount" }],
  });
  assert.deepEqual(failureFrom(502, null), { kind: "error", code: "internal_error" });
  assert.deepEqual(failureFrom(400, "<html>"), { kind: "error", code: "invalid_request" });
});

test("mutations carry the CSRF token and JSON; reads do not need it", async () => {
  const seen: Seen[] = [];
  const api = createApiClient({ fetch: fakeFetch(200, { ok: 1 }, seen) });
  api.setCsrfToken("token-123");
  await api.get("/api/operations");
  await api.send("POST", "/api/operations", { amount: 1 });
  await api.send("DELETE", "/api/operations/4", { expectedUpdatedAt: "t" });
  const headers = seen.map((s) => (s.init?.headers ?? {}) as Record<string, string>);
  assert.equal(headers[0]?.["X-CSRF-Token"], undefined);
  assert.equal(headers[1]?.["X-CSRF-Token"], "token-123");
  assert.equal(headers[1]?.["Content-Type"], "application/json");
  assert.equal(headers[2]?.["X-CSRF-Token"], "token-123");
  assert.equal(seen[1]?.init?.credentials, "same-origin");
  assert.equal(seen[1]?.init?.body, JSON.stringify({ amount: 1 }));
});

test("auth_required triggers onUnauthorized; other errors do not", async () => {
  let calls = 0;
  const onUnauthorized = () => {
    calls += 1;
  };
  const expired = createApiClient({ fetch: fakeFetch(401, { error: "auth_required" }), onUnauthorized });
  assert.deepEqual(await expired.get("/api/operations"), { ok: false, failure: { kind: "unauthorized" } });
  const wrongPassword = createApiClient({ fetch: fakeFetch(401, { error: "invalid_credentials" }), onUnauthorized });
  await wrongPassword.send("POST", "/api/auth/login", {});
  assert.equal(calls, 1);
});

test("network failures, empty bodies and unwrap", async () => {
  const offline = createApiClient({
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  assert.deepEqual(await offline.get("/api/reference"), { ok: false, failure: { kind: "error", code: "network" } });
  const noContent = createApiClient({ fetch: fakeFetch(200, undefined) });
  assert.deepEqual(await noContent.send("POST", "/api/auth/logout"), { ok: true, data: null });
  assert.equal(unwrap({ ok: true, data: 5 }), 5);
  assert.throws(() => unwrap({ ok: false, failure: { kind: "conflict" } }), (error: unknown) => error instanceof ApiError && error.failure.kind === "conflict");
});
