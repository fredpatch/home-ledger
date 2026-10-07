# Agent Kit

Portable Planner → Implementer → Reviewer → QA workflow for VS Code custom agents. Identical across projects; only `PROJECT.md` and `TASKS.md` are project-specific.

## Contents

```text
AGENTS.md                         operating rules (portable, never edited per project)
WORKFLOW.md                       stages, gates, states (portable)
.agent-kit-version                kit version copied into each project
.github/agents/*.agent.md         Planner, Implementer, Reviewer, QA
.github/skills/*/                 api-contract-design, database-safety, frontend-design,
                                  security-review, webapp-testing
templates/PROJECT.template.md     project facts → becomes PROJECT.md
templates/TASKS.template.md       active state → becomes TASKS.md
templates/vscode-settings.template.jsonc   command tiers → .vscode/settings.json
```

## Install in a new project

1. Copy everything except this README into the repository root.
2. Do not create `PROJECT.md` or `TASKS.md` by hand: open the Planner. It detects they are missing and enters bootstrap mode (AGENTS §15), drafts both from `templates/`, and stops for your answers.
3. Answer every `<TODO>` and approve. The Planner never writes files: paste the approved drafts yourself, or hand them to the Implementer. Then set up `.vscode/settings.json`.
4. Put the spec where `PROJECT.md §Docs` says, then ask the Planner for the first slice.

## Updating the kit

Change the kit here first, bump `.agent-kit-version`, then copy the changed portable files to each project. Never fix a portable file inside a single project.
