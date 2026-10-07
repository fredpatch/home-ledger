# Decisions log

Newest first.

## 2026-10-07 — P1.1 scaffold

- **Workspaces**: npm workspaces `packages/shared`, `packages/server`, `packages/client` (`@suivi/*`).
- **Node floor**: `>=22.12.0` (required by Vite 7); declared in root `engines`.
- **Modules**: ESM everywhere (`"type": "module"`); server/shared use `NodeNext` resolution with `.js` import suffixes.
- **Base TypeScript config**: `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`); the client overrides to `Bundler` resolution, `react-jsx`, DOM libs, `noEmit`.
- **Tests**: `node:test` on compiled output; `npm test` rebuilds shared and server (each `dist/` is cleaned first by `scripts/clean-dist.mjs`) then runs quoted `node --test` globs. No supertest: `/health` is tested with `fetch` on an ephemeral port.
- **Server split**: `app.ts` exports the Express app, `index.ts` listens (default `127.0.0.1:3001`, overridable by `HOST`/`PORT`).
- **Scripts**: only `typecheck`, `build`, `test`, `dev:api`, `dev:client` in P1.1; `db:*`/`test:integration`/`seed:*` arrive in P1.3, `import:*` in P1.9, `backup:*` in P1.10 (no stubs).
- **Line endings**: `.gitattributes` = `* text=auto eol=lf`.
