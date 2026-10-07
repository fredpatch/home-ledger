export type DomainErrorCode =
  | "invalid_amount"
  | "invalid_date"
  | "invalid_budget_month"
  | "invalid_rollover_day"
  | "invalid_opening_balance";

// Stable codes only; the client maps them to French messages.
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode) {
    super(code);
    this.name = "DomainError";
    this.code = code;
  }
}
