# La Palette Store

Medusa 2 backend (Store API + Admin) for the La Palette Garden catering shop.
The storefront is not part of this repository: it is built in the
la-palette-garden repository under `lapalettegarden.pl/catering` and calls the
Store API server-side. See `.specify/memory/constitution.md` for project
principles and `specs/*/contracts/` for the Store API contracts.

## Prerequisites

- Node.js 24 LTS, with Corepack enabled: `corepack enable`
- A stable internet connection — the database is always hosted on Railway,
  even locally. **No Docker, no local Postgres, no Redis.**
- Access to the Railway project `la-palette-store`, environment `dev`
  (`fa8233d4-b8df-4990-b293-88e1da791022`), to get the Postgres connection
  string for `apps/backend/.env`.

## Local development (3 commands)

```bash
pnpm install
pnpm bootstrap   # one-time: creates .env files, runs migrations + seed
pnpm dev
```

- Backend: http://localhost:9000 (health: `/health`, readiness: `/status`)
- Admin: http://localhost:9000/app — `admin@lapalette.local` / `lapalette-local`

`pnpm bootstrap` prints a "Storefront publishable key" — the Store API client
in la-palette-garden needs it.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the backend |
| `pnpm seed` | Re-runs the idempotent seed (safe any time) |
| `pnpm db:migrate` | Runs Medusa migrations, including the `catering` module |
| `pnpm lint` / `pnpm typecheck` | Static checks |
| `pnpm test:unit` | Fast tests, no database — what CI runs |
| `pnpm test:integration` | Backend tests against a temporary DB on the dev Postgres server (created and dropped automatically); run locally before merging changes to a critical path |
| `pnpm build` | Production build of the backend |

`specs/001-project-skeleton/` and `specs/002-remove-locale-prefix/` are kept as
history; they still describe the storefront that used to live in `apps/`.

## Staging

Every change merged to `main` that passes CI is deployed automatically to a
public, non-indexed staging environment on Railway (see
`specs/001-project-skeleton/research.md`, R-11). Setting it up needs a
GitHub remote and access to the Railway project's `staging` environment —
see the feature's tasks (`specs/001-project-skeleton/tasks.md`, T046–T050).

## Project layout

```
apps/backend/      Medusa 2 server + Admin (extended with the `catering` module)
```
