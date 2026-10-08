import { openDatabase } from "../connection.js";
import { databasePathFromEnv } from "../paths.js";
import { seedReference } from "./seed-reference.js";

const path = databasePathFromEnv();
const { sqlite, db } = openDatabase(path);
try {
  const report = seedReference(db);
  console.log(`Reference seed applied to ${path}:`, JSON.stringify(report));
} finally {
  sqlite.close();
}
