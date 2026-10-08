# Decisions log

Newest first.

## 2026-10-07 — P1.3 database schema and reference seed

- **Naming**: English snake_case. FR→EN mapping: comptes→`accounts`, enveloppes→`envelopes`, categories→`categories`, budgets→`budgets`, operations→`operations`, projets→`projects`, prets→`loans`, pointages→`reconciliations`, parametres→`settings`, journal_modifs→`change_log`. `table` is reserved so `change_log.table_name`; `avant/apres` → `before_json`/`after_json`. Envelope source `courant_carte` → `current_card`.
- **Scope**: 10 tables. `recurrents` and `clotures` are deferred (so no `recurrent_id`); `reinforced_envelope_id` (renforts) is deferred.
- **Identifiers**: INTEGER autoincrement primary keys; shared `Id` is `number`.
- **Enums**: constants live in `@suivi/shared` (`reference.ts`, `operation-class.ts`) and feed both the schema CHECKs and the domain code.
- **Integrity in the database**: CHECKs for the R2 field matrix (mirrors `validateOperationShape`, proven by a parity integration test), amount integer in 1..MAX_SAFE_INTEGER (`typeof() = 'integer'`), valid dates/months, expense category ⇔ envelope. `operations.status` NOT NULL default `validated`.
- **Triggers** (custom drizzle-kit migration `triggers`, the one hand-written migration): `operations.class` = `categories.class` on INSERT/UPDATE; no hard DELETE on `operations` (soft delete); a category class cannot change once used; `change_log` is append-only.
- **Natural keys**: UNIQUE `accounts.name`, `envelopes.name`, `categories.name` (seed idempotence). `operations.source_ref` TEXT NULL UNIQUE for import idempotency (P1.9, e.g. `xlsx-v9.3:row-5`).
- **Seed**: insert-only, one transaction, matched by natural key, never overwrites edits. `rolls_over` true only for Salaire, Épargne, Chargement du pot; `accounts.funds_projects` true only for BGFI épargne. Budgets are per category for 2026-10. The workbook's "PC / Projet" maps to the seed's "Achat projet" (P1.9).
- **Root `drizzle-orm` devDependency** (same 0.45.4 pin as the server): required so the hoisted `drizzle-kit` resolves `drizzle-orm`; do not remove it as a duplicate.
- **Open observation**: October pot-sourced budgets total 435 500, above the ~400 000 pot.
- **Tests**: DB tests use a fresh temp file under `os.tmpdir()`, removed afterwards; `DATABASE_PATH` is never used by tests.

## 2026-10-07 — P1.2 shared domain

- **Validators**: plain TypeScript validators and typed `DomainError` with stable codes (no message text; the client maps codes to French). zod is deferred to the API slices (P1.5+); no new dependency.
- **Identifiers**: domain ids are English (classes `revenue|expense|transfer|savings|project|loan|repayment|adjustment`, statuses `draft|validated`); DB column naming remains decided in P1.3.
- **R2 field matrix** (docs/spec.md §Modèle de données, §R7, §R10): fields foreign to a class are rejected. Loan requires `loanId` (the receivable is created in the same transaction in P1.5); transfer accepts an optional `projectId` (savings → card transfers linked to a project); adjustment takes exactly one account (source = negative gap, destination = positive gap).
- **R3 rollover**: driven by a caller-supplied `rollsOver` boolean (category property from P1.3: true for Salaire, Épargne and the monthly pot transfer "Chargement du pot"; renforts and other transfers do not roll over): `rollsOver && day >= rolloverDay` (default 25, configurable 1–28 so it exists in every month) → next month, with year change. The manual override stays outside the function.
- **Theoretical balance**: opening balance + inflows − outflows over validated, non-deleted operations; cutoff on the operation date (>= opening date, <= optional inclusive `asOf`), never on the budget month.
- **Deferred**: account-type rules (R7), R9 fields (`client`, `usage`).

## 2026-10-07 — P1.1 scaffold

- **Workspaces**: npm workspaces `packages/shared`, `packages/server`, `packages/client` (`@suivi/*`).
- **Node floor**: `>=22.12.0` (required by Vite 7); declared in root `engines`.
- **Modules**: ESM everywhere (`"type": "module"`); server/shared use `NodeNext` resolution with `.js` import suffixes.
- **Base TypeScript config**: `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`); the client overrides to `Bundler` resolution, `react-jsx`, DOM libs, `noEmit`.
- **Tests**: `node:test` on compiled output; `npm test` rebuilds shared and server (each `dist/` is cleaned first by `scripts/clean-dist.mjs`) then runs quoted `node --test` globs. No supertest: `/health` is tested with `fetch` on an ephemeral port.
- **Server split**: `app.ts` exports the Express app, `index.ts` listens (default `127.0.0.1:3001`, overridable by `HOST`/`PORT`).
- **Scripts**: only `typecheck`, `build`, `test`, `dev:api`, `dev:client` in P1.1; `db:*`/`test:integration`/`seed:*` arrive in P1.3, `import:*` in P1.9, `backup:*` in P1.10 (no stubs).
- **Line endings**: `.gitattributes` = `* text=auto eol=lf`.
