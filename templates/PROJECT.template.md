# PROJECT.md — <TODO: project name>

Project-specific facts for AI agents. `AGENTS.md`, `WORKFLOW.md`, `.github/agents` and `.github/skills` come unchanged from the portable Agent Kit (version in `.agent-kit-version`). Put project facts here, not there.

Every `<TODO: …>` must be answered by the developer or proven by the repository before implementation starts (AGENTS §15). Delete the example lines once filled.

---

## Identity

```text
Name        <TODO: project name>
Purpose     <TODO: one or two lines — what the product does>
Users       <TODO: who uses it, how many roles in V1>
```

## Stack

```text
Runtime           <TODO: e.g. Node >= 22>
Package manager   <TODO: e.g. npm workspaces — never yarn/pnpm/bun>
Backend           <TODO: e.g. Express 5 + TypeScript (ESM)>
Frontend          <TODO: e.g. React 18 + Vite 7 + TanStack Query>
Test framework    <TODO: e.g. node:test (shared, server); client: none>
```

## Layout

```text
<TODO: one line per app/package and its responsibility>
example: packages/shared   contracts, schemas, types, stable error codes
example: packages/server   HTTP API, domain services, DB schema/migrations, scripts
example: packages/client   UI
Shared contracts  <TODO: location → consumers>
Server modules    <TODO: e.g. packages/server/src/modules/<name>/>
```

## Architecture

```text
Backend layering   <TODO: e.g. Service → Controller → Route/Middleware; business rules in services>
Slice order        <TODO: e.g. shared contracts → service → controller → route → server tests → client → developer validation>
Conventions        <TODO: e.g. typed domain errors, server-authoritative rules, audit without PII, client never shows raw error codes>
```

## Data

```text
Database          <TODO: engine + version, how it runs locally>
Local target      <TODO: host:port or file path; how to prove it is local>
ORM / migrations  <TODO: ORM + migration tool; migration folder>
Generated files   <TODO: paths agents must never hand-edit>
Seeds             <TODO: seed scripts (ask tier) or "none">
```

## Security

```text
Authentication    <TODO: model — sessions, tokens, OTP, …>
Authorization     <TODO: roles; always enforced server-side>
CSRF / origin     <TODO: when cookies authenticate>
Public writes     <TODO: abuse controls, or "none">
Sensitive data    <TODO: what must never be logged or put in audit metadata>
```

## Commands

Validation set (root):

```text
typecheck           <TODO: command or "not configured">
build               <TODO>
unit tests          <TODO>
integration tests   <TODO: or "none">
schema check        <TODO: or "none">
lint                <TODO: or "not configured">
client tests        <TODO: or "none — client acceptance = typecheck + build + developer browser check">
```

Tiers (mirrored in `.vscode/settings.json`, see `templates/vscode-settings.template.jsonc`):

```text
auto    git status · git diff · git log · git show · git branch --show-current
        <TODO: read-only validation commands>
ask     <TODO: migrations, generation, integration tests, seeds, containers, dev servers>
        npm install / ci / any lockfile change · git add · git commit
never   <TODO: project-specific destructive commands>  (+ AGENTS §4 list)
```

## Runtime

```text
Local IDE agents        auto tier only; ask tier with explicit approval
Chat / cloud runtimes   never run project commands — prepare changes and commands for the developer
Who closes validation   the developer's local execution only
```

## Docs

```text
Active state          TASKS.md
Specs                 <TODO: e.g. docs/spec.md, docs/iterations/<id>.md>
Business rules        <TODO: file(s) + how rules are numbered/cited>
Schema / data model   <TODO>
State machines        <TODO: or "none">
Decisions log         <TODO: e.g. docs/decisions.md, newest first>
Gotchas               <TODO: or "§Gotchas below">
Changelog             <TODO: or "none">
Project tracker       <TODO: name + tool, or "none — TASKS.md only">
Pattern library       <TODO: name + access method, or "none">
                      engineering reference only — never authoritative for this project's business rules
Pattern access        <TODO: connector/MCP, or content supplied by the developer>
                      unavailable → report PATTERN REFERENCE NOT AVAILABLE
```

## Language

```text
UI              <TODO>
Code / ids      <TODO: e.g. English>
Commits         <TODO: e.g. English — type(scope): description>
Technical docs  <TODO>
```

## Branches

```text
Protected   <TODO: e.g. main>
Active      <TODO: current working branch>
Naming      <TODO: e.g. phase-N or sprint-N, created from validated main>
```

## Developer

```text
Name        <TODO>
Approves    plans, migrations, dependencies, commits, merges, deployment
Validates   functional acceptance locally (<TODO: commands, browser, DB inspection tool>)
```

## Gotchas

- <TODO: environment traps — ports, OS line endings, path separators, native builds, test cleanup hazards>
