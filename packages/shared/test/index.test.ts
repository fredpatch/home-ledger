import assert from "node:assert/strict";
import { test } from "node:test";
import { appInfo } from "../src/index.js";

test("appInfo exposes the application name", () => {
  assert.equal(appInfo.name, "Suivi financier");
});
