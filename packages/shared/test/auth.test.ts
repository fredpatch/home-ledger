import assert from "node:assert/strict";
import { test } from "node:test";
import { PASSWORD_MAX_LENGTH, parseLoginRequest } from "../src/index.js";

test("login request: valid shapes are accepted", () => {
  assert.deepEqual(parseLoginRequest({ password: "secret", longSession: true }), {
    password: "secret",
    longSession: true,
  });
  assert.deepEqual(parseLoginRequest({ password: "x".repeat(PASSWORD_MAX_LENGTH), longSession: false }), {
    password: "x".repeat(PASSWORD_MAX_LENGTH),
    longSession: false,
  });
});

test("login request: extra fields are dropped", () => {
  assert.deepEqual(parseLoginRequest({ password: "secret", longSession: false, admin: true }), {
    password: "secret",
    longSession: false,
  });
});

test("login request: invalid shapes are rejected", () => {
  for (const body of [
    null,
    undefined,
    "secret",
    [],
    {},
    { password: "secret" },
    { password: "", longSession: true },
    { password: "x".repeat(PASSWORD_MAX_LENGTH + 1), longSession: true },
    { password: 123, longSession: true },
    { password: "secret", longSession: "true" },
  ]) {
    assert.equal(parseLoginRequest(body), null, JSON.stringify(body));
  }
});
