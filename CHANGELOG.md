# Changelog

## Unreleased

- P1.5: operations API (create / edit / soft delete / list + filters, `change_log`, R2/R3/R7/R10 checks, optimistic lock, pot warning) and settings API (allowlist, bounds, `pot_budget_tolerance`).
- P1.4: single-account authentication — argon2id password (`npm run auth:set-password`), DB sessions with `__Host-sid` cookie (short desktop / long phone), CSRF token + Origin check on mutations, persistent login throttle, default-deny `/api`.

- P1.3: SQLite schema (10 tables, CHECKs, triggers), first migrations, reference seed (accounts, envelopes, categories, Oct 2026 budgets, settings); shared `Id` is now `number`.
- P1.2: shared pure domain (operation classes and R2 field rules, R3 budget month, theoretical balance, amount/date validation).
- P1.1: npm workspace scaffold (shared placeholder, Express `GET /health`, blank Vite/React page).
