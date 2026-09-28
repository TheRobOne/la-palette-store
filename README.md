# La Palette Store

Catering e-commerce store for La Palette Garden, built on Medusa 2 and the
Medusa Next.js Starter Storefront. See `specs/001-project-skeleton/` for the
full specification, plan and validation guide this skeleton implements, and
`.specify/memory/constitution.md` for project principles.

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
- Storefront: http://localhost:8000

`pnpm bootstrap` prints a "Storefront publishable key" — copy it into
`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` in `apps/storefront/.env.local`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Runs backend + storefront in parallel |
| `pnpm seed` | Re-runs the idempotent seed (safe any time) |
| `pnpm db:migrate` | Runs Medusa migrations, including the `catering` module |
| `pnpm lint` / `pnpm typecheck` | Static checks, both apps |
| `pnpm test:unit` | Fast tests, no database — what CI runs |
| `pnpm test:integration` | Backend tests against a temporary DB on the dev Postgres server (created and dropped automatically); run locally before merging changes to a critical path |
| `pnpm test:e2e` | Playwright smoke test + accessibility audit against running local apps |
| `pnpm build` | Production builds of both apps |

Full command reference: `specs/001-project-skeleton/contracts/dev-commands.md`.
Step-by-step validation: `specs/001-project-skeleton/quickstart.md`.

## Staging

Every change merged to `main` that passes CI is deployed automatically to a
public, non-indexed staging environment on Railway (see
`specs/001-project-skeleton/research.md`, R-11). Setting it up needs a
GitHub remote and access to the Railway project's `staging` environment —
see the feature's tasks (`specs/001-project-skeleton/tasks.md`, T046–T050).

## Project layout

```
apps/backend/      Medusa 2 server + Admin (extended with the `catering` module)
apps/storefront/    Next.js Starter Storefront, restyled with La Palette Garden tokens
```
