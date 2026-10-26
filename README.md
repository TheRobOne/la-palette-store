# La Palette Store

Medusa 2 backend (Store API + Admin) for the La Palette Garden catering shop.
The storefront is not part of this repository: it is built in the
la-palette-garden repository under `lapalettegarden.pl/catering` and calls the
Store API server-side. See `.specify/memory/constitution.md` for project
principles and `specs/*/contracts/` for the Store API contracts.

## Prerequisites

- Node.js 24 LTS, with Corepack enabled: `corepack enable`
- A stable internet connection — the development database is hosted on Railway,
  even locally. **No Docker, no Redis.** A local PostgreSQL is needed only for
  integration tests (see below).
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
| `pnpm test:integration` | Backend tests against a temporary DB (created and dropped automatically); run locally before merging changes to a critical path — see "Integration tests" |
| `pnpm build` | Production build of the backend |

`specs/001-project-skeleton/` and `specs/002-remove-locale-prefix/` are kept as
history; they still describe the storefront that used to live in `apps/`.

## Integration tests

Each suite creates and drops its own temporary database. Against the Railway dev
Postgres (TCP proxy) the migrations of that database regularly fail with
`connect ETIMEDOUT` before any test runs, so run them against a local
PostgreSQL 16 (e.g. `brew install postgresql@16 && brew services start postgresql@16`),
overriding the server only for the run:

```bash
cd apps/backend
DB_HOST=localhost DB_PORT=5432 DB_USERNAME=$USER DB_PASSWORD= \
  pnpm run test:integration:http -- integration-tests/http/<suite>.spec.ts
```

With `localhost` Medusa's test runner drops the SSL options itself; `.env` stays
unchanged and the dev server keeps using Railway.

## Environments (state 2026-10-23)

Railway project `la-palette-store` (`fa8233d4-b8df-4990-b293-88e1da791022`):

| Environment | Services | Used by |
|---|---|---|
| `dev` | `Postgres` only | local development (`apps/backend/.env`) |
| `staging` | `backend`, `Postgres-v4yf` | the la-palette-garden shop on Vercel (`MEDUSA_BACKEND_URL`) |

There is no `production` environment yet; `api.lapalettegarden.pl` (constitution) is
not configured in DNS or Railway.

Staging `backend`:

- URL: https://backend-staging-4198.up.railway.app (`/status`, Admin at `/app`);
  `ALLOW_INDEXING=false` → `X-Robots-Tag: noindex, nofollow`.
- Deploys automatically on every push to `main` (GitHub `TheRobOne/la-palette-store`),
  root `/`, build `pnpm install --frozen-lockfile && pnpm --filter ./apps/backend build`,
  start `cd apps/backend/.medusa/server && npm install && npm run predeploy && npm run start`
  (`predeploy` = migrations + idempotent seed), health check `/health`.
- "Wait for CI" (`checkSuites`) is **off**, so `main` deploys even when CI is red. CI failed
  on every run until 2026-10-23 (pnpm missing before `setup-node`); now that it passes,
  turn the option on in the dashboard (service → Settings → Source).
- Variables are set in Railway (names: `APP_ENV`, `DATABASE_URL`, `MEDUSA_BACKEND_URL`, CORS,
  secrets, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `MEDUSA_WORKER_MODE`, `DISABLE_MEDUSA_ADMIN`,
  `ALLOW_INDEXING`, `CATERING_REVALIDATE_URL`/`_SECRET`).
- E-mails (spec 006) need `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `STOREFRONT_URL` and
  `NOTIFICATION_ALLOWLIST` (team addresses — staging never e-mails real customers); without
  `RESEND_API_KEY` e-mails are only logged. Staff address: Admin → Settings → Store.
- Leftover: an unattached volume `postgres-lapalette-volume` (5 GB) in staging, from the
  first staging database; safe to delete in the dashboard once confirmed unused.

## Project layout

```
apps/backend/      Medusa 2 server + Admin (extended with the `catering` module)
```
