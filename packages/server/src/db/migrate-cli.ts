import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { openDatabase } from "./connection.js";
import { runMigrations } from "./migrate.js";
import { databasePathFromEnv } from "./paths.js";

const path = databasePathFromEnv();
mkdirSync(dirname(path), { recursive: true });

const { sqlite, db } = openDatabase(path);
try {
  runMigrations(db);
  console.log(`Migrations applied to ${path}`);
} finally {
  sqlite.close();
}
