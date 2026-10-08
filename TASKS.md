# Suivi financier — Active Execution State

> Single source of active state for agents. Backlog/roadmap: `docs/spec.md §Phases`. Phase brief: `docs/brief-phase1.md`. History: `CHANGELOG.md`, Git.
> Update rules: WORKFLOW §12 and §14.

## Now

```text
Branch            phase-1
Iteration         Phase 1 — Socle
Active slice      P1.6
Workflow state    PLANNING
Last validated    P1.5 — 2026-10-08 (commit bfc4703; manual E2E deferred to P1.6)
Next action       Planner: plan P1.6 (client shell, login, quick entry); include the P1.5 carry-over checklist
```

## Phase 1 slices

| Slice | Scope                                                                                                                                                                                                                                          | Depends on | State                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| P1.1  | Repo scaffold: npm workspaces (shared/server/client), TS config, scripts from PROJECT §Commands, `.gitignore`, `.gitattributes`, `.vscode/settings.json`, `docs/decisions.md`, `CHANGELOG.md`                                                  | —          | CLOSED — Fred validated 2026-10-07 (43fd22c)    |
| P1.2  | Shared domain (pure, tested): operation classes and allowed combinations (R2), budget-month rule (R3), theoretical balance per account, amount/date validation                                                                                 | P1.1       | CLOSED — Fred validated 2026-10-07 (73cbb86)    |
| P1.3  | DB schema + first migration: comptes, categories, enveloppes, budgets, operations, projets, prets, pointages, parametres, journal_modifs; reference seed (6 accounts, categories with class and envelope source, Oct 2026 budgets, parameters) | P1.2       | CLOSED — Fred validated 2026-10-08 (d68ebc4)    |
| P1.4  | Auth: single account, argon2id, DB session, HttpOnly cookie, CSRF, login rate limit                                                                                                                                                            | P1.3       | CLOSED — Fred validated 2026-10-08 (73a6e5e)    |
| P1.5  | Operations API: create / edit / soft delete / list + filters, transfers, closed-month guard, journal_modifs                                                                                                                                    | P1.3, P1.4 | CLOSED — Fred validated 2026-10-08 (bfc4703)    |
| P1.6  | Client shell (PWA, French UI, login) + mobile quick entry (R2 derivation shown before save)                                                                                                                                                    | P1.5       | PLANNING                                        |
| P1.7  | Desktop journal (filters, inline edit) + current-month budget view by envelope                                                                                                                                                                 | P1.5, P1.6 | —                                               |
| P1.8  | Accounts + reconciliation (pointage): theoretical vs real balance, gap, adjustment operation, cash tolerance (R12)                                                                                                                             | P1.5       | —                                               |
| P1.9  | Import Excel v9.3 with preview: mapping + corrections from `docs/spec.md §Migration`, opening balances at 2026-10-01                                                                                                                           | P1.5, P1.8 | —                                               |
| P1.10 | Ops: nightly backup + restore script, Docker Compose, `tailscale serve` runbook, deployment on homelab                                                                                                                                         | P1.4–P1.9  | —                                               |

Phase 1 exit criteria (`docs/spec.md §Phases`): October 2026 imported, opening balances entered, one weekly reconciliation done with a gap explained, backup restore tested.

QA expected values after import (`docs/brief-phase1.md`): October 2026 earned income 1 023 000; repayment 150 000; Cody loan 150 000 settled; project purchase 280 315 outside envelopes.

## Closed

```text
—
```

## Next iteration

Phase 2 — Discipline (`docs/spec.md §Phases`): recurring payments + "À valider" inbox, savings (R6), projects and savings pockets (R7), daily allowance, month-end forecast, monthly close (R13), history, PWA reminders.

## Blockers

None.

Known non-blocking notes:

- P1.1 was committed before the Reviewer stage; review passed afterwards (REVIEW PASSED WITH NOTES). From P1.2 on, commit only after Gate 2 (WORKFLOW §11).
- Server listens on 127.0.0.1 by default: P1.10 container must set `HOST=0.0.0.0` deliberately.
- Shared tests rely on `@types/node` hoisted from server; add it to shared if hoisting becomes fragile.
- DB column naming (English vs spec's French names) to decide in P1.3 and record in `docs/decisions.md`.
- P1.3 must fix the id type (number vs string) — `same_account` compares with `===`.
- P1.5 must validate operations before writing; `computeTheoreticalBalance` trusts its input.
- P1.3 seed must set `rollsOver` on categories: true for Salaire, Épargne and "Chargement du pot"; false for renforts and other transfers (tests required).
- P1.5: validate settings values (budget_rollover_day 1–28, cash_tolerance ≥ 0) at the API; settings table has no value CHECK.
- P1.10: ship src/db/migrations in the Docker image (SQL not copied to dist/).
- P1.10: review npm audit (4 moderate) before deployment; prod image installs runtime deps only.
- Open data question: October pot-sourced budgets 435 500 vs pot ≈ 400 000.
- The Excel import file stays in `local-data/` (gitignored); QA import runs only on Fred's machine.
- Phase 2 (R13): closed-month guard on operations deferred from P1.5 — no `clotures` table yet (P1.5 Q1).
- Phase 2: journal settings edits in `change_log` (needs a row id convention for text keys; P1.5 Q5).
- P1.6: disable the save button while a request is pending (no idempotency key on POST /api/operations).
- P1.7: give the pot category a stable key instead of matching the name "Chargement du pot".
- P1.5 closed with the manual end-to-end check deferred to P1.6 (Fred, 2026-10-08): run the carry-over below during P1.6 QA.

### P1.6 carry-over — P1.5 manual E2E (PowerShell, throwaway database)

1. Terminal A: `$env:DATABASE_PATH="$env:TEMP\suivi-qa.db"; npm run db:migrate; npm run seed:reference; npm run auth:set-password` → seed reports `settings: 5`; then `npm run dev:api`.
2. Terminal B: log in (P1.4 checklist step 5), then call the API with `Origin`, `Cookie: __Host-sid=…` and `X-CSRF-Token` headers.
3. `GET /api/settings` → 200, 5 values (rollover 25, pot tolerance 0, opening date 2026-10-01), no `auth` key.
4. POST pot transfer 2026-09-29, 400 000, Chargement du pot, accounts 1 → 2 → 201, `budgetMonth` 2026-10, warning `budget_exceeds_pot` (435 500 vs 400 000).
5. POST an expense with `class` → 422 `class:unknown_field`; without → 201, `warnings: []`.
6. POST loan 150 000 from account 3 with `loanPerson` → 201; repayment 150 001 → 422 `amount:exceeds_remaining`; 150 000 → 201.
7. PATCH the expense with a stale `expectedUpdatedAt` → 409; with the current one → 200.
8. DELETE the expense → 200 `{"warnings":[]}`; GET it → 404.
9. PATCH settings `budgetRolloverDay: 29` → 422 `out_of_range`; `potBudgetTolerance: 40000` → 200.
10. Any POST without `X-CSRF-Token` → 403 `csrf_invalid`. The `dev:api` log shows only `auth:` lines, no amounts.
11. Stop `dev:api`, inspect (expect change_log rows for operations and loans, loan `settled`, one soft-deleted operation):

```powershell
node -e "const D=require('better-sqlite3');const d=new D(process.env.DATABASE_PATH,{readonly:true});console.log(d.prepare('select table_name,count(*) n from change_log group by 1').all(),d.prepare('select person,amount,status from loans').all(),d.prepare('select id,deleted_at from operations where deleted_at is not null').all())"
```

12. Optional: Fred deletes `$env:TEMP\suivi-qa.db*`.

## Environment constraints

- See `PROJECT.md §Data` and `§Gotchas` (SQLite file path, Windows dev / Linux deploy, native better-sqlite3).
- Chat/cloud runtimes do not run project commands; only Fred's local execution closes a gate (`PROJECT.md §Runtime`).

## Handoff

```text
Branch            phase-1
Slice             P1.6
Workflow state    PLANNING
Approved goal     Phase 1 — Socle (docs/spec.md §Phases)
✅ Done           P1.1 scaffold (43fd22c); P1.2 shared domain (73cbb86); P1.3 DB schema, migrations (incl. triggers), reference seed (d68ebc4); P1.4 single-account auth (73a6e5e); P1.5 operations and settings API (bfc4703)
⏳ Pending        P1.6 plan; P1.5 manual E2E (carry-over); push phase-1 (Fred)
Validation done   P1.5: typecheck/build/db:check green; npm test 71/71; test:integration 57/57 (agent-run); review passed with notes (findings resolved); QA passed with limitations; Fred validated Gate 2
Not validated     P1.5 manual E2E against dev:api (deferred to P1.6)
Risks/blockers    none
Next action       Planner plans P1.6; Fred approves
```
