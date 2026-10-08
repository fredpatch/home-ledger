import type { ParseResult, ValidationIssue } from "./auth.js";
import { isValidDate } from "./dates.js";
import { DomainError } from "./errors.js";

// docs/decisions.md P1.4: the settings API is an allowlist; auth_* keys are never read or returned.
export interface AppSettings {
  /** docs/spec.md §R6: savings target, % of salary. */
  readonly savingsTargetPercent: number;
  /** docs/spec.md §R3: rollover day of the budget month. */
  readonly budgetRolloverDay: number;
  /** docs/spec.md §R12: weekly cash tolerance (XAF). */
  readonly cashTolerance: number;
  /** docs/decisions.md 2026-10-08: tolerance before the pot warning (XAF). */
  readonly potBudgetTolerance: number;
  /** Opening balances date; read-only through the API (P1.5 plan Q10); null until seeded. */
  readonly openingDate: string | null;
}

export type SettingName = keyof AppSettings;
export type SettingsPatch = Partial<Omit<AppSettings, "openingDate">>;

// API name → settings.key in the database.
export const SETTING_DB_KEYS: Readonly<Record<SettingName, string>> = {
  savingsTargetPercent: "savings_target_percent",
  budgetRolloverDay: "budget_rollover_day",
  cashTolerance: "cash_tolerance",
  potBudgetTolerance: "pot_budget_tolerance",
  openingDate: "opening_date",
};

type NumericSetting = Exclude<SettingName, "openingDate">;

const BOUNDS: Readonly<Record<NumericSetting, { readonly min: number; readonly max: number }>> = {
  savingsTargetPercent: { min: 0, max: 100 },
  budgetRolloverDay: { min: 1, max: 28 },
  cashTolerance: { min: 0, max: Number.MAX_SAFE_INTEGER },
  potBudgetTolerance: { min: 0, max: Number.MAX_SAFE_INTEGER },
};

const NUMERIC_SETTINGS = Object.keys(BOUNDS) as NumericSetting[];

function inBounds(name: NumericSetting, value: number): boolean {
  const { min, max } = BOUNDS[name];
  return value >= min && value <= max;
}

/** Validates a PATCH body; unknown names and openingDate are rejected. */
export function parseSettingsPatch(body: unknown): ParseResult<SettingsPatch> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, issues: [{ field: "body", code: "invalid" }] };
  }
  const issues: ValidationIssue[] = [];
  const patch: Partial<Record<NumericSetting, number>> = {};
  for (const [name, value] of Object.entries(body)) {
    if (name === "openingDate") {
      issues.push({ field: name, code: "read_only" });
    } else if (!(NUMERIC_SETTINGS as string[]).includes(name)) {
      issues.push({ field: name, code: "unknown_field" });
    } else if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      issues.push({ field: name, code: "invalid" });
    } else if (!inBounds(name as NumericSetting, value)) {
      issues.push({ field: name, code: "out_of_range" });
    } else {
      patch[name as NumericSetting] = value;
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: patch };
}

// Used when a key is missing from the database (seeded values: docs/spec.md §R3, §R6, §R12; Q4).
export const DEFAULT_SETTINGS: Readonly<Omit<AppSettings, "openingDate">> = {
  savingsTargetPercent: 30,
  budgetRolloverDay: 25,
  cashTolerance: 5000,
  potBudgetTolerance: 0,
};

/** Reads stored text values; a missing key takes its default (openingDate: null), an invalid one throws. */
export function parseStoredSettings(stored: ReadonlyMap<string, string>): AppSettings {
  const numeric = {} as Record<NumericSetting, number>;
  for (const name of NUMERIC_SETTINGS) {
    const text = stored.get(SETTING_DB_KEYS[name]);
    if (text === undefined) {
      numeric[name] = DEFAULT_SETTINGS[name];
      continue;
    }
    const value = Number(text);
    if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(value) || !inBounds(name, value)) {
      throw new DomainError("invalid_setting");
    }
    numeric[name] = value;
  }
  const openingDate = stored.get(SETTING_DB_KEYS.openingDate) ?? null;
  if (openingDate !== null && !isValidDate(openingDate)) {
    throw new DomainError("invalid_setting");
  }
  return { ...numeric, openingDate };
}
