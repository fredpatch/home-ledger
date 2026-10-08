export interface AppInfo {
  readonly name: string;
}

export const appInfo: AppInfo = { name: "Suivi financier" };

export * from "./balance.js";
export * from "./budget-month.js";
export * from "./dates.js";
export * from "./errors.js";
export * from "./money.js";
export * from "./operation-class.js";
export * from "./operation-rules.js";
export * from "./reference.js";
