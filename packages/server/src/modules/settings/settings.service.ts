import { inArray } from "drizzle-orm";
import { parseStoredSettings, SETTING_DB_KEYS, type AppSettings, type SettingsPatch } from "@suivi/shared";
import type { AppDatabase } from "../../db/connection.js";
import { settings } from "../../db/schema.js";

// docs/decisions.md P1.4: only allowlisted keys are ever selected, so auth_* rows are never read here.
const ALLOWED_KEYS = Object.values(SETTING_DB_KEYS);

export function readSettings(db: AppDatabase): AppSettings {
  const rows = db.select().from(settings).where(inArray(settings.key, ALLOWED_KEYS)).all();
  return parseStoredSettings(new Map(rows.map((row) => [row.key, row.value])));
}

// Settings edits are not journaled in change_log (P1.5 plan Q5: Phase 2).
export function updateSettings(db: AppDatabase, patch: SettingsPatch): AppSettings {
  return db.transaction((tx) => {
    for (const name of Object.keys(patch) as (keyof SettingsPatch)[]) {
      const value = patch[name];
      if (value === undefined) {
        continue;
      }
      const key = SETTING_DB_KEYS[name];
      tx.insert(settings)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } })
        .run();
    }
    return readSettings(tx);
  });
}
