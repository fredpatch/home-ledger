import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../src/config.js";
import { checkNewPassword, hashPassword, verifyPassword } from "../src/modules/auth/password.js";
import { clearedSessionCookie, readCookie, sessionCookie } from "../src/modules/auth/cookies.js";
import { hashSessionToken, SESSION_DURATIONS } from "../src/modules/auth/session.service.js";

test("config: APP_ORIGIN is required and must be a bare origin", () => {
  assert.deepEqual(loadConfig({ APP_ORIGIN: "https://suivi.example.ts.net" }), {
    appOrigin: "https://suivi.example.ts.net",
  });
  assert.deepEqual(loadConfig({ APP_ORIGIN: "http://localhost:5173" }), { appOrigin: "http://localhost:5173" });
  for (const value of [undefined, "", "suivi.example.ts.net", "https://suivi.example.ts.net/", "https://x.ts.net/app", "ftp://x"]) {
    assert.throws(() => loadConfig({ APP_ORIGIN: value }), String(value));
  }
});

test("cookies: readCookie finds the named cookie only", () => {
  assert.equal(readCookie(undefined, "__Host-sid"), null);
  assert.equal(readCookie("a=1; __Host-sid=abc_-; b=2", "__Host-sid"), "abc_-");
  assert.equal(readCookie("x__Host-sid=abc", "__Host-sid"), null);
  assert.equal(readCookie("__Host-sid=first; __Host-sid=second", "__Host-sid"), "first");
});

test("cookies: session cookie carries the required attributes", () => {
  const cookie = sessionCookie("token", 86_400);
  assert.match(cookie, /^__Host-sid=token; /);
  for (const attribute of ["Path=/", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=86400"]) {
    assert.ok(cookie.split("; ").includes(attribute), attribute);
  }
  assert.doesNotMatch(cookie, /Domain=/i);
  assert.match(clearedSessionCookie(), /^__Host-sid=; .*Max-Age=0$/);
});

test("sessions: durations match the approved policy", () => {
  const hour = 3_600_000;
  assert.deepEqual(SESSION_DURATIONS.short, { idleMs: 12 * hour, absoluteMs: 24 * hour });
  assert.deepEqual(SESSION_DURATIONS.long, { idleMs: 30 * 24 * hour, absoluteMs: 90 * 24 * hour });
});

test("sessions: the stored id is a SHA-256 hex digest, not the token", () => {
  const token = "A".repeat(43);
  const digest = hashSessionToken(token);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.notEqual(digest, token);
});

test("password: new password policy", () => {
  assert.equal(checkNewPassword("short-pass1", "short-pass1"), "too_short");
  assert.equal(checkNewPassword("twelve-chars", "twelve-chars"), null);
  assert.equal(checkNewPassword("twelve-chars", "twelve-charz"), "mismatch");
  assert.equal(checkNewPassword("x".repeat(1025), "x".repeat(1025)), "too_long");
});

test("password: argon2id hash verifies only the right password", async () => {
  const encoded = await hashPassword("synthetic-password");
  assert.match(encoded, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await verifyPassword(encoded, "synthetic-password"), true);
  assert.equal(await verifyPassword(encoded, "synthetic-passwore"), false);
  assert.equal(await verifyPassword("not-a-hash", "synthetic-password"), false);
});
