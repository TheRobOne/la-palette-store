# Contract: Environment configuration (FR-009)

Committed examples: `apps/backend/.env.template`, `apps/storefront/.env.template` (scaffold
naming). Real `.env*` files are git-ignored. A missing required value MUST stop startup
with a message naming the variable (spec US1 scenario 4).

## Backend (`apps/backend`)

| Variable | Required | Local (dev) | Staging |
|---|---|---|---|
| `APP_ENV` | yes | `local` | `staging` |
| `DATABASE_URL` | yes | Railway **dev** Postgres public URL (secret, not committed) | Railway **staging** Postgres reference |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` | integration tests only | dev Postgres proxy host/port/credentials | — |
| `MEDUSA_BACKEND_URL` | yes | `http://localhost:9000` | Railway backend domain |
| `STORE_CORS` | yes | `http://localhost:8000` | storefront staging URL |
| `ADMIN_CORS` | yes | `http://localhost:9000` | backend staging URL |
| `AUTH_CORS` | yes | `http://localhost:8000,http://localhost:9000` | both staging URLs |
| `JWT_SECRET`, `COOKIE_SECRET` | yes | dev values in `.env` | Railway secrets (random) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | non-local | — | Railway secrets |
| `MEDUSA_WORKER_MODE` | staging | — | `shared` |
| `DISABLE_MEDUSA_ADMIN` | staging | — | `false` |
| `ALLOW_INDEXING` | no | `false` | `false` |
| `PORT` | no | `9000` | Railway-provided |
| `CATERING_REVALIDATE_URL` | no | empty (call skipped) | `https://www.lapalettegarden.pl/api/catering/revalidate` |
| `CATERING_REVALIDATE_SECRET` | with the URL | empty | Railway secret, same value as `CATERING_REVALIDATE_SECRET` in the la-palette-garden Vercel project |

The two `CATERING_REVALIDATE_*` variables were added by
[003-storefront-revalidation](../../003-storefront-revalidation/contracts/revalidate.md).

No `REDIS_URL` in this feature (constitution: Redis only in production).

## Storefront (`apps/storefront`)

| Variable | Required | Local | Staging |
|---|---|---|---|
| `MEDUSA_BACKEND_URL` | yes | `http://localhost:9000` | backend staging URL |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | yes | printed by seed | printed by staging seed / Admin |
| `NEXT_PUBLIC_BASE_URL` | yes | `http://localhost:8000` | storefront staging URL |
| `NEXT_PUBLIC_DEFAULT_REGION` | yes | `pl` | `pl` |
| `ALLOW_INDEXING` | no | `false` | `false` |

## Rules

- The dev database URL is a secret: it lives only in the developer's `.env`, never in git.
- Local `.env` MUST NOT contain staging credentials.
- CI needs **no** variables or secrets (lint, typecheck, unit tests, build only); builds
  use placeholder values where a variable is read at build time.
