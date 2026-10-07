# Decisions log

Newest first.

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
