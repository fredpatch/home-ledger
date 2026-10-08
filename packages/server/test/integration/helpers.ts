import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type OpenedDatabase } from "../../src/db/connection.js";
import { runMigrations } from "../../src/db/migrate.js";

export interface TestDatabase extends OpenedDatabase {
  cleanup(): Promise<void>;
}

// Fresh migrated database in the OS temp dir. Never touches DATABASE_PATH.
export async function createTestDb(): Promise<TestDatabase> {
  const dir = await mkdtemp(join(tmpdir(), "suivi-test-"));
  const opened = openDatabase(join(dir, "test.db"));
  runMigrations(opened.db);
  return {
    ...opened,
    async cleanup() {
      opened.sqlite.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

// Returns the SQLite error message, or null when the statement succeeded.
export function sqlError(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
