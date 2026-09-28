# Research: Project Skeleton

**Feature**: 001-project-skeleton | **Date**: 2026-09-28 | **Constitution**: v2.0.0

Sources: public Medusa docs (docs.medusajs.com — deployment/general, installation,
create-medusa-app reference, testing-tools, integration-tests) and the npm registry, both
consulted 2026-09-28. No paid Medusa services used.

## Verified versions (npm registry, 2026-09-28)

| Package / tool | Latest stable | Major used | Notes |
|---|---|---|---|
| `@medusajs/*` (medusa, framework, cli, js-sdk, test-utils), `create-medusa-app` | 2.21.2 | 2 | Lockstep versions |
| Node.js | 24.x LTS | 24 | Medusa: v20.19+/v22.12+ LTS; Next.js starter: "Node v24 LTS or lower" |
| `next` | 16.3.6 | 16 | |
| `react` (storefront) | 19.3.0 | 19 | |
| `react` (Admin extensions) | — | 18 | **Exception**: `@medusajs/dashboard` depends on `react@^18.3.1` |
| `typescript` | 7.0.2 | 7 | Backend gated (R-04) |
| `tailwindcss` | 4.3.3 | 4 | |
| `eslint` / `eslint-config-next` | 10.11.0 / 16.3.6 | 10 / 16 | |
| `jest` | 30.5.2 | 30 | Backend (Medusa test tooling is Jest-based) |
| `@playwright/test` | 1.63.0 | 1 | Local e2e smoke only |
| `pnpm` | 12.6.0 | 12 | Pinned via `packageManager` + Corepack (local has 11.10) |

Dropped vs. previous plan (Principle VII): Turborepo, Vitest, next-intl, Docker Compose,
Redis.

## R-01 Scaffold with `create-medusa-app`

- **Decision**: Generate the project with
  `pnpm dlx create-medusa-app@latest --use-pnpm --with-nextjs-starter --db-url <dev URL> --no-browser`
  in a temp directory and move the result into this repo. It produces a pnpm workspace
  (`pnpm-workspace.yaml`, root `package.json`) with `apps/backend` (Medusa + Admin) and
  `apps/storefront` (Next.js Starter Storefront).
- **Rationale**: Official layout, least custom setup (VII); the starter already contains
  cart/checkout/account flows needed by later features (Constitution stack: storefront
  "based on the official Medusa Next.js storefront").
- **Follow-up in this feature**: bump every dependency the scaffold pins below the latest
  major (Next, React, Tailwind, TypeScript, ESLint…) and fix resulting breakages; any
  blocked bump goes to Complexity Tracking.
- **Alternatives considered**: hand-written storefront (more code to maintain later);
  Turborepo monorepo (extra tool, no benefit for 2 apps and 1 developer).

## R-02 Database: Railway PostgreSQL, dev + staging

- **Decision**: One Railway project `la-palette-store` with two environments:
  - `dev` — only a PostgreSQL service; local apps connect through its public TCP proxy URL.
  - `staging` — PostgreSQL + `backend` + `storefront` services.
- **Rationale**: Constitution v2.0.0 infra rule (Railway Postgres everywhere, separate DBs,
  no Docker). Environments keep dev and staging isolated inside one project.
- **Connection note**: if the public proxy requires SSL, configure
  `projectConfig.databaseDriverOptions` accordingly; verified at implementation.
- **Alternatives considered**: Supabase (rejected by stakeholder), local Postgres via
  Homebrew (extra install, violates "only runtime + package manager").

## R-03 No Redis (local + staging)

- **Decision**: Do not configure Redis modules; Medusa uses its built-in in-memory event
  bus, workflow engine, locking and cache.
- **Rationale**: Docs: Redis modules are "highly recommended for production (not
  required)"; constitution requires Redis only in production. Staging runs a single
  instance with `MEDUSA_WORKER_MODE=shared`.

## R-04 TypeScript 7 in the backend

- **Decision**: TS 7 in both apps; first backend task is a gate: `medusa build`,
  `medusa develop` and integration tests must pass on TS 7. Otherwise pin latest 6.x in
  `apps/backend` and record it in Complexity Tracking.
- **Rationale**: Medusa declares no TypeScript peer range; must be proven.

## R-05 Catering product attributes

- **Decision**: Custom module `catering` with model `catering_product_info` linked 1:1 to
  `product` (module link). Store API reads it via `fields=+catering_info.*`.
- **Rationale**: Constitution I (extension via modules/links); agreed home for future
  catering logic (FR-014). Details: [data-model.md](data-model.md).
- **Alternatives considered**: product `metadata` (untyped, unvalidated).

## R-06 Poland configuration & seed

- **Decision**: Replace the scaffold's demo seed (`apps/backend/src/scripts/seed.ts`) with
  an idempotent seed: region "Polska" (`pl`, `pln`), tax region PL default 8%, PLN price
  preference tax-inclusive, sales channel + publishable key, stock location, 2 categories,
  6 fictional `test-` products with catering info and placeholder images. Admin user:
  `APP_ENV=local` → `admin@lapalette.local` / `lapalette-local`; otherwise requires
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` or exits non-zero.
- **Rationale**: FR-003, FR-004, FR-004a; gross PLN prices (Constitution IV).
- **Open (non-blocking)**: final VAT mapping confirmed with accountant in catalog feature.

## R-07 Health check

- **Decision**: Built-in `GET /health` (liveness, used by Railway) + custom `GET /status`
  checking the database.
- **Rationale**: FR-010 requires DB status; `/health` does not report it.

## R-08 Storefront adaptation

- **Decision**: Keep the starter's structure; restyle with La Palette tokens in a single
  Tailwind 4 `@theme` file (values from `la-palette-garden/src/app/globals.css`), fonts
  Instrument Serif (`next/font/google`) + Switzer (`next/font/local`, woff2 copied from the
  brand repo), logo/hero from `la-palette-garden/public`. Default country `pl`. Visible
  shell texts (header, footer, home, legal placeholders, backend-down message) move to a
  plain typed dictionary `src/i18n/pl.ts` — no i18n library.
- **Rationale**: FR-006–FR-008 with minimum dependencies (VII). Starter screens outside
  scope (cart, checkout, account) remain but are unlinked from navigation until their
  features translate and restyle them.
- **Brand tokens**: `beige-light #faf7f2`, `beige-dark #ded6cf`, `brown-black #322a2a`,
  `brown-dark #3f3232`, `brown-light #836b5e`, `brown-button #6f5141`,
  `green-dark #2f422e`, `separator hsla(21,26%,35%,0.2)`.

## R-09 Product images

- **Decision**: Placeholder SVGs committed in `apps/backend/static/placeholders/`, served by
  Medusa's local file provider; seed stores absolute URLs from `MEDUSA_BACKEND_URL`.
- **Rationale**: Survives redeploys (files are in the repo); no object storage needed.

## R-10 Tests & CI

- **Decision**:
  - CI (GitHub Actions, one job): `pnpm install --frozen-lockfile` → `pnpm lint` →
    `pnpm typecheck` → `pnpm test:unit` → `pnpm build`. No database, no secrets.
  - Backend unit tests: Jest `test:unit` (scaffold scripts). Storefront unit tests: Node's
    built-in `node --test` (no extra dependency).
  - Local only, before merging critical-path changes: `pnpm test:integration`
    (`medusaIntegrationTestRunner`, which creates a temporary database
    `medusa-{random}-integration-{worker}` on the dev Railway Postgres server via
    `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD` and drops it afterwards — dev data untouched)
    and `pnpm test:e2e` (one Playwright smoke test + axe WCAG 2.2 AA audit against running
    local apps).
- **Rationale**: Constitution v2.0.0 workflow; FR-011; SC-003 (< 5 min).

## R-11 Staging deployment

- **Decision**: Railway services deploy from GitHub `main` with **Wait for CI** enabled.
  - `backend`: root `apps/backend`; build `pnpm build` (outputs `.medusa/server`); start
    `cd .medusa/server && npm install && npm run predeploy && npm run start` (docs'
    command), with the backend `predeploy` script extended to
    `medusa db:migrate && medusa exec ./src/scripts/seed.js` so every deploy migrates and
    re-runs the idempotent seed; env
    `MEDUSA_WORKER_MODE=shared`, `DISABLE_MEDUSA_ADMIN=false`; health check `/health`.
  - `storefront`: root `apps/storefront`; `pnpm build` / `pnpm start`.
  - Railway-generated domains; secrets in Railway variables.
- **Rationale**: FR-011a, SC-003a (< 15 min, no manual step).
- **Dependency**: GitHub remote + Railway access (neither exists yet).

## R-12 No indexing on staging

- **Decision**: `ALLOW_INDEXING=false` → storefront `robots.txt` `Disallow: /`,
  `noindex,nofollow` meta and `X-Robots-Tag` header; backend middleware adds `X-Robots-Tag`
  to all responses (Admin included).
- **Rationale**: Clarification: staging public, not indexed.
