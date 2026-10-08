import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { serverRoot } from "../src/db/paths.js";

// Every command that opens DATABASE_PATH must load the same optional .env (docs/decisions.md P1.4).
test("scripts: database commands load the same optional .env", () => {
  const manifest = JSON.parse(readFileSync(join(serverRoot(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  for (const name of ["dev", "db:migrate", "seed:reference", "auth:set-password"]) {
    const script = manifest.scripts[name] ?? "";
    assert.match(script, /^tsx (watch )?--env-file-if-exists=\.env /, name);
  }
});
