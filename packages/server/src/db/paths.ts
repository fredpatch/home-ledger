import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Works from src/ (tsx) and dist/src/ (compiled): walk up to the package that holds drizzle.config.ts.
export function serverRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "drizzle.config.ts"))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("server package root not found");
    }
    dir = parent;
  }
  return dir;
}

export function migrationsFolder(): string {
  return join(serverRoot(), "src", "db", "migrations");
}

// PROJECT.md §Data: DATABASE_PATH, default packages/server/data/dev.db. Tests never use this.
export function databasePathFromEnv(): string {
  return process.env.DATABASE_PATH ?? join(serverRoot(), "data", "dev.db");
}
