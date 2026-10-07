# Suivi financier — Active Execution State

> Single source of active state for agents. Backlog/roadmap: `docs/spec.md §Phases`. Phase brief: `docs/brief-phase1.md`. History: `CHANGELOG.md`, Git.
> Update rules: WORKFLOW §12 and §14.

## Now

```text
Branch            phase-1
Iteration         Phase 1 — Socle
Active slice      P1.2
Workflow state    PLANNING
Last validated    P1.1 — 2026-10-07 (commit 43fd22c)
Next action       Planner: plan P1.2 (shared domain: R2 classes, R3 budget month, theoretical balance)
```

## Phase 1 slices

| Slice | Scope                                                                                                                                                                                                                                          | Depends on | State                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------- |
| P1.1  | Repo scaffold: npm workspaces (shared/server/client), TS config, scripts from PROJECT §Commands, `.gitignore`, `.gitattributes`, `.vscode/settings.json`, `docs/decisions.md`, `CHANGELOG.md`                                                  | —          | CLOSED — Fred validated 2026-10-07 (43fd22c) |
| P1.2  | Shared domain (pure, tested): operation classes and allowed combinations (R2), budget-month rule (R3), theoretical balance per account, amount/date validation                                                                                 | P1.1       | PLANNING                                     |
| P1.3  | DB schema + first migration: comptes, categories, enveloppes, budgets, operations, projets, prets, pointages, parametres, journal_modifs; reference seed (6 accounts, categories with class and envelope source, Oct 2026 budgets, parameters) | P1.2       | —                                            |
| P1.4  | Auth: single account, argon2id, DB session, HttpOnly cookie, CSRF, login rate limit                                                                                                                                                            | P1.3       | —                                            |
| P1.5  | Operations API: create / edit / soft delete / list + filters, transfers, closed-month guard, journal_modifs                                                                                                                                    | P1.3, P1.4 | —                                            |
| P1.6  | Client shell (PWA, French UI, login) + mobile quick entry (R2 derivation shown before save)                                                                                                                                                    | P1.5       | —                                            |
| P1.7  | Desktop journal (filters, inline edit) + current-month budget view by envelope                                                                                                                                                                 | P1.5, P1.6 | —                                            |
| P1.8  | Accounts + reconciliation (pointage): theoretical vs real balance, gap, adjustment operation, cash tolerance (R12)                                                                                                                             | P1.5       | —                                            |
| P1.9  | Import Excel v9.3 with preview: mapping + corrections from `docs/spec.md §Migration`, opening balances at 2026-10-01                                                                                                                           | P1.5, P1.8 | —                                            |
| P1.10 | Ops: nightly backup + restore script, Docker Compose, `tailscale serve` runbook, deployment on homelab                                                                                                                                         | P1.4–P1.9  | —                                            |

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
- The Excel import file stays in `local-data/` (gitignored); QA import runs only on Fred's machine.

## Environment constraints

- See `PROJECT.md §Data` and `§Gotchas` (SQLite file path, Windows dev / Linux deploy, native better-sqlite3).
- Chat/cloud runtimes do not run project commands; only Fred's local execution closes a gate (`PROJECT.md §Runtime`).

## Handoff

```text
Branch            phase-1
Slice             P1.2
Workflow state    PLANNING
Approved goal     Phase 1 — Socle (docs/spec.md §Phases)
✅ Done           P1.1 scaffold (43fd22c): workspaces, GET /health, blank client, scripts typecheck/build/test/dev:*
⏳ Pending        P1.2 plan
Validation done   P1.1: typecheck/build green; npm test 2/2; Fred: /health 200, page displays "Suivi financier"
Not validated     —
Risks/blockers    none
Next action       Planner plans P1.2; Fred approves
```
