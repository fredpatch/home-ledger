# PROJECT.md — Suivi financier

Project-specific facts for AI agents. `AGENTS.md`, `WORKFLOW.md`, `.github/agents` and `.github/skills` come unchanged from the portable Agent Kit (version in `.agent-kit-version`). Put project facts here, not there.

---

## Identity

```text
Name        Suivi financier
Purpose     Personal finance tracking web app (PWA): daily expenses, recurring payments,
            accounts and weekly balance checks, monthly envelopes, savings rate,
            savings-funded projects, dev-activity income. Replaces the Excel workbook v9.3.
Users       one user (the developer); no other roles, no public pages
Hosting     self-hosted on the developer's homelab, reachable only through Tailscale
```

## Stack

```text
Runtime           Node >= 22 (tests use `node --test` glob patterns)
Package manager   npm workspaces — never yarn/pnpm/bun
Backend           Express 5 + TypeScript (ESM)
Frontend          React 18 + Vite 7 + TanStack Query, installable PWA
Database          SQLite (better-sqlite3) + Drizzle ORM / drizzle-kit
Test framework    node:test (shared, server); no client test framework
Deployment        Docker Compose on the homelab; HTTPS via `tailscale serve`
```

## Layout

```text
packages/shared   contracts, zod schemas, types, stable error codes, PURE domain rules
                  (operation classes, budget-month rule, balance computation) — no I/O
packages/server   HTTP API, domain services, Drizzle schema/migrations, import, backup scripts
packages/client   React PWA — mobile quick entry + desktop review screens (French UI)
Shared contracts  packages/shared → consumers: packages/server, packages/client
Server modules    packages/server/src/modules/<name>/ (auth, accounts, categories, operations,
                  budgets, reconciliation, import, …)
```

## Architecture

```text
Backend layering   Service → Controller → Route/Middleware; business rules in shared domain + services
Slice order        shared contracts/domain → service → controller → route/middleware
                   → server tests → client (French UI) → developer validation
Conventions        business rules cited by id from docs/spec.md (R1–R13);
                   category decides class and envelope — never entered by the user (R2);
                   amounts are positive integers in XAF, direction comes from class + accounts;
                   dates are 'YYYY-MM-DD' strings, budget month is 'YYYY-MM';
                   soft delete only; every edit/delete written to journal_modifs;
                   a closed month is read-only (reopen = explicit, logged action);
                   typed domain errors; client never shows raw error codes
```

## Data

```text
Database          SQLite file, WAL mode, `PRAGMA foreign_keys = ON` on every connection
Local target      file path from env DATABASE_PATH (default packages/server/data/dev.db);
                  tests use a fresh temp file — never DATABASE_PATH
Production        Docker volume on the homelab — agents never touch it
ORM / migrations  Drizzle ORM + drizzle-kit; migrations in packages/server/src/db/migrations
Generated files   packages/server/src/db/migrations/** (SQL + meta), packages/*/dist/**
Seeds             npm run seed:reference (accounts, categories, envelopes, parameters) — ask tier
Import source     Excel v9.3 file in local-data/ (gitignored) — never committed
Backups           nightly online backup (`VACUUM INTO` / backup API), encrypted, 2nd disk + off-site;
                  restore tested monthly
```

## Security

```text
Authentication    single account: password hashed with argon2id; server-side session in DB;
                  HttpOnly + Secure + SameSite=Strict cookie; short session on desktop, long on phone
Authorization     one user; every API route except /auth/login and /health requires a session
CSRF / origin     CSRF token on every cookie-authenticated mutation + origin check
Public writes     none — app is not exposed outside the tailnet (no Funnel, no port forwarding);
                  login rate-limited
Sensitive data    password, session ids, balances and amounts never in logs, push payloads or error messages;
                  import file and database never committed
Compliance        never install or open the app from an employer-managed (domain-joined) machine
```

## Commands

Scripts below are created by slice P1.1. Until P1.1 is committed, every command is **not configured** (AGENTS §4: never invent scripts).

Validation set (root):

```text
typecheck           npm run typecheck
build               npm run build
unit tests          npm test                   (shared + server, no DB file)
integration tests   npm run test:integration   (server, temp SQLite file)
schema check        npm run db:check
lint                not configured
client tests        none — client acceptance = typecheck + build + developer browser check
```

Tiers (mirrored in `.vscode/settings.json`):

```text
auto    git status · git diff · git log · git show · git branch --show-current
        npm run typecheck · npm run build · npm test · npm run db:check
ask     npm run db:generate · npm run db:migrate · npm run test:integration
        npm run seed:* · npm run import:* · npm run backup:*
        npm run dev:api · npm run dev:client (QA runtime checks; stop afterwards)
        docker compose … · npm install / ci / any lockfile change · git add · git commit
never   deleting or overwriting any *.db file · any command against the production volume
        (+ AGENTS §4 list)
```

## Runtime

```text
Local VS Code agents     auto tier only; ask tier with explicit approval
Chat / cloud runtimes    never run project commands — prepare changes and commands for Fred
Who closes validation    Fred's local execution only
```

## Docs

```text
Active state          TASKS.md
Spec                  docs/spec.md — business rules R1–R13, data model, screens, phases, migration
                      (written in French; cite as "docs/spec.md §R7")
Phase brief           docs/brief-phase1.md — scope and QA expected values for Phase 1
Business rules        docs/spec.md §Flux financier et règles métier (R1–R10)
                      docs/spec.md §Fiabilité (R11–R13)
Schema / data model   docs/spec.md §Modèle de données
State machines        none yet (operation status: brouillon → validée; month: open → closed → reopened)
Decisions log         docs/decisions.md — newest first
Gotchas               §Gotchas below
Changelog             CHANGELOG.md
Project tracker       none — TASKS.md only
Pattern library       Notion "AI Project Kickoff — Reusable Implementation Patterns & Blueprints"
                      (optional) — engineering reference only, never authoritative for this project
Pattern access        Notion connector/MCP when available; otherwise content supplied by Fred;
                      unavailable → report PATTERN REFERENCE NOT AVAILABLE
```

## Language

```text
UI              French
Code / ids      English (DB columns may keep the spec's French names — decide once in P1.3, log in decisions.md)
Commits         English — type(scope): description
Technical docs  English; business spec stays in French
```

## Branches

```text
Protected   main
Active      phase-1
Naming      phase-N (one branch per phase, created from validated main)
```

## Developer

```text
Name        Fred
Approves    plans, migrations, dependencies, commits, merges, deployment
Validates   functional acceptance locally (commands, browser on PC and phone, SQLite inspection)
```

## Gotchas

- Development on Windows, deployment on Linux: watch CRLF/LF churn and path separators; add `.gitattributes` in P1.1.
- `better-sqlite3` is a native module: the Docker image must build it for Linux (do not copy Windows `node_modules`).
- Money is integer XAF only — never floats, never decimals in UI or DB.
- Date-only values ('YYYY-MM-DD') must never pass through `new Date()` + UTC conversion: the day can shift.
- Budget-month rule (R3): salary and savings dated on or after the 25th belong to the next month.
- Personal financial data: `local-data/`, `*.db`, backups and `.env*` are gitignored; never paste real amounts into issues or test fixtures (fixtures use synthetic data, except the QA import run on Fred's machine).
- PWA push on iPhone works only when the app is installed on the home screen; payloads stay generic (no amounts).
