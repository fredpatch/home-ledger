import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/connection.js";

// In-memory database: unit tests never create a database file.
test("GET /health returns 200 without a session", async () => {
  const { sqlite, db } = openDatabase(":memory:");
  const server = createApp({ db, config: { appOrigin: "http://localhost:5173" } }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.equal(response.headers.get("x-powered-by"), null);
  } finally {
    server.close();
    sqlite.close();
  }
});
