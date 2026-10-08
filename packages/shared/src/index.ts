export interface AppInfo {
  readonly name: string;
}

export const appInfo: AppInfo = { name: "Suivi financier" };

export * from "./auth.js";
export * from "./balance.js";
export * from "./budget-month.js";
export * from "./dates.js";
export * from "./errors.js";
export * from "./money.js";
export * from "./operation-class.js";
export * from "./operation-rules.js";
export * from "./operations.js";
export * from "./pot.js";
export * from "./reference.js";
export * from "./settings.js";
