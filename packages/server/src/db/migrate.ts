import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { AppDatabase } from "./connection.js";
import { migrationsFolder } from "./paths.js";

export function runMigrations(db: AppDatabase): void {
  migrate(db, { migrationsFolder: migrationsFolder() });
}
