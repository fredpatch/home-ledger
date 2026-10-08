# Decisions log

Newest first.

## 2026-10-08 — P1.5 operations API (rules accepted at review)

- **Class immutable on edit**: an edit cannot move an operation to a category of another class (`class_change_forbidden`); delete and re-enter instead.
- **Loan link immutable**: a loan operation's `loanId` never changes; its receivable follows its amount, date and person.
- **Loan delete**: blocked while live repayments exist (422 `has_repayments`).
- **Loan liveness**: a loan is live if and only if its loan operation is live; consumers (e.g. "Prêts en cours", R10) must join on a live loan operation.
- **`loanPerson`**: rejected on non-loan operations, `null` included (`field_forbidden`).
- **DELETE** `/api/operations/:id` answers 200 `{ warnings }`, not 204, so a pot warning can be returned.
- **Q9 override detection** compares the stored month with the one computed using the *current* rollover day: after changing `budget_rollover_day`, older rolled-over operations read as manual overrides. Accepted.
- **Pot category**: found by name ("Chargement du pot"); a stable key replaces the name in P1.7.

## 2026-10-08 — Budget envelopes vs pot

- **Pot-funded budgets exceeding the pot**: warn, never block; the tolerance comes from settings.

## 2026-10-08 — P1.4 authentication

- **Login method**: password only in Phase 1; passkey (docs/spec.md §Architecture, hébergement, sécurité) is deferred.
- **Password**: argon2id via `@node-rs/argon2` 2.2.2 (exact pin; prebuilt binaries, no compiler in Docker), memory 19 456 KiB, time 2, parallelism 1. Hash stored in `settings` under `auth_password_hash`: **any settings API (P1.5) must allowlist its keys and never return `auth_*`.** Set only with `npm run auth:set-password` (TTY, masked, typed twice, ≥ 12 characters); it revokes every session and clears the login lock. No password configured → login answers `invalid_credentials`.
- **Sessions**: table `sessions`, keyed by SHA-256 of a 32-byte random id; the raw id exists only in the cookie. Kind chosen by the client (`longSession`): short (desktop) 12 h sliding / 24 h absolute; long (phone) 30 days sliding / 90 days absolute. Sliding expiry written at most once a minute. New id at every login (the presented session is deleted); expired rows purged at login; logout deletes the row.
- **Cookie**: `__Host-sid`, HttpOnly, Secure, SameSite=Strict, Path=/, no Domain, Max-Age = absolute lifetime. Parsed by hand (no `cookie-parser`).
- **CSRF / origin**: synchronizer token per session, returned by login and `GET /api/auth/session`, required in `X-CSRF-Token` on POST/PUT/PATCH/DELETE. Every mutation, login included, must carry `Origin` equal to `APP_ORIGIN`; a missing Origin is rejected. The server refuses to start without a valid `APP_ORIGIN`.
- **Routes**: API under `/api`; `/api/auth/login` and `/health` are the only public routes; default deny before routing (unknown authenticated routes → 404 `not_found`). API responses are `Cache-Control: no-store`.
- **Throttle**: one global counter in table `auth_throttle` (single row), hand-written (no `express-rate-limit`): 5 failures within 15 min → 15 min lock, even for the right password; the attempt is counted before the password check (parallel-safe); survives restarts; a success resets it. No per-IP limit: behind `tailscale serve` every request comes from 127.0.0.1.
- **Errors and logs**: stable codes in `@suivi/shared` (`ApiErrorCode`). Log lines `auth: login ok (short|long)`, `auth: login failed`, `auth: locked`, `auth: login refused (locked)`, `auth: logout`, `auth: no password configured` — no IP, password, hash, session id or token. Client errors (malformed JSON, body > 10 kB) are not logged because their message can quote the body.
- **App factory**: `createApp({ db, config, clock })` replaces the exported `app` singleton; the clock is injected for expiry tests. Migrations are not run at server start.
- **Convention exception**: auth data (`sessions`, `auth_throttle`, `settings.auth_*`) is excluded from soft delete and from `change_log`. Sessions and throttle rows are hard-deleted; password changes are not journaled, so the append-only log never keeps old hashes.
- **Dev env**: `dev:api`, `db:migrate`, `seed:reference` and `auth:set-password` load `packages/server/.env` if present (`--env-file-if-exists`), so they all target the same `DATABASE_PATH`; `packages/server/.env.example` lists names only. Empty `HOST`/`PORT` fall back to the defaults.

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
