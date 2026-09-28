---

description: "Task list for 001-project-skeleton"
---

# Tasks: Project Skeleton

**Input**: Design documents from `/specs/001-project-skeleton/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — the spec requires unit tests in CI (FR-011), plus local integration
tests and an end-to-end smoke test (Constitution VI, research R-10).

**Organization**: Tasks are grouped by user story (spec.md) so each story can be
implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 from spec.md
- Paths are relative to the repository root (`apps/backend`, `apps/storefront`)

## Global rules for every task

- Medusa knowledge comes only from docs.medusajs.com and the npm registry (constitution
  "Knowledge sources"); never use the paid Medusa MCP.
- Every dependency at its latest stable major, verified with `npm view <pkg> version`
  at the time of the task; exceptions go to Complexity Tracking in `plan.md`.
- Never commit `.env` files or secrets. Never point local config at the staging database.
- Railway: project `la-palette-store` (`fa8233d4-b8df-4990-b293-88e1da791022`), env `dev`
  (`cd872844-bd6c-464b-bd58-08829421acf8`), service `Postgres`
  (`b6d107ba-e7ae-433d-a678-e00772f948d8`), public proxy `switchback.proxy.rlwy.net:45909`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Generate the official Medusa monorepo and bring it to latest majors

- [ ] T001 Scaffold the project in the session scratchpad with `pnpm dlx create-medusa-app@latest la-palette-store --use-pnpm --with-nextjs-starter --skip-db --no-browser` (`--skip-db` so no demo data lands in the dev DB), then copy its contents into the repository root (`package.json`, `pnpm-workspace.yaml`, `apps/backend/`, `apps/storefront/`, config files) without overwriting `.specify/`, `.claude/`, `specs/` or `.git/`; merge its `.gitignore` into `/.gitignore`
- [ ] T002 Configure the root workspace in `/package.json`: `"packageManager": "pnpm@12.6.0"` (or the current latest), `"engines": {"node": ">=24 <25"}`, and scripts `dev` (both apps in parallel via `pnpm -r --parallel dev`), `seed`, `db:migrate`, `bootstrap`, `lint`, `typecheck`, `test:unit`, `test:integration`, `test:e2e`, `build` exactly as listed in `specs/001-project-skeleton/contracts/dev-commands.md`; add `/.npmrc` with `engine-strict=true`
- [ ] T003 Bump every dependency in `apps/backend/package.json` and `apps/storefront/package.json` to its latest stable major (verify each with `npm view`), except `react`/`react-dom` used by Admin extensions in `apps/backend` which stay on `^18.3.1` (required by `@medusajs/dashboard`); migrate the starter to Tailwind CSS 4 and Next.js 16 if it ships older majors; run `pnpm install` and fix build breakages; record any blocked bump in the Complexity Tracking table of `specs/001-project-skeleton/plan.md`
- [ ] T004 TypeScript 7 gate for the backend (research R-04): with `typescript@7` in `apps/backend/package.json`, confirm `pnpm --filter backend build` and `pnpm --filter backend dev` start cleanly; if Medusa's CLI fails on TS 7, pin the latest `typescript@6` in `apps/backend/package.json` only and add the exception with the error message to Complexity Tracking in `specs/001-project-skeleton/plan.md`
- [ ] T005 [P] Add ESLint 10 flat configs `apps/backend/eslint.config.mjs` and `apps/storefront/eslint.config.mjs` (storefront extends `eslint-config-next`), a `lint` script in each app, and a `typecheck` script (`tsc --noEmit`) in each app's `package.json`
- [ ] T006 [P] Ensure `/.gitignore` ignores `.env`, `.env.*` but not `.env.template`, plus `.medusa/`, `.next/`, `node_modules/`, `playwright-report/`, `test-results/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuration and database connectivity needed by every story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 [P] Write `apps/backend/.env.template` with every backend variable from `specs/001-project-skeleton/contracts/configuration.md` (local defaults filled in, `DATABASE_URL` and DB_* left empty with a comment "Railway dev Postgres — never staging"); no `REDIS_URL`
- [ ] T008 [P] Write `apps/storefront/.env.template` with `MEDUSA_BACKEND_URL=http://localhost:9000`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=` (comment: printed by `pnpm seed`), `NEXT_PUBLIC_BASE_URL=http://localhost:8000`, `NEXT_PUBLIC_DEFAULT_REGION=pl`, `ALLOW_INDEXING=false`
- [ ] T009 Update `apps/backend/medusa-config.ts`: load env with `loadEnv`, validate required variables (`APP_ENV`, `DATABASE_URL`, `MEDUSA_BACKEND_URL`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `JWT_SECRET`, `COOKIE_SECRET`) and throw `Missing required environment variable: <NAME>` for the first missing one; set `projectConfig.databaseDriverOptions` so the pool gives up after 30 s with a clear "database cannot be reached" error, and enable SSL with `rejectUnauthorized: false` only if the Railway proxy requires it (Railway's Postgres image uses a self-signed cert); register no Redis modules; set `workerMode` from `MEDUSA_WORKER_MODE` (default `shared`) and `admin.disable` from `DISABLE_MEDUSA_ADMIN`
- [ ] T010 Create the untracked `apps/backend/.env` from the template: build `DATABASE_URL` for the Railway **dev** Postgres using the public proxy `switchback.proxy.rlwy.net:45909`, user/password/db from the dev `Postgres` service variables (read via the Railway plugin `list-variables` for env `dev` only), and set `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD` to the same proxy values for integration tests; create `apps/storefront/.env` from its template; confirm `git status` does not list either file
- [ ] T011 Implement `/scripts/bootstrap.mjs` (wired to root `pnpm bootstrap`): copy each `apps/*/.env.template` to `.env` when missing, exit with "Set DATABASE_URL in apps/backend/.env (Railway dev Postgres)" if it is empty, then run `pnpm db:migrate` and `pnpm seed`, and print the publishable key hint for `apps/storefront/.env`
- [ ] T012 Run `pnpm db:migrate` against the dev database and confirm Medusa's core tables are created (connectivity check for T009/T010)

**Checkpoint**: Backend boots against Railway dev Postgres; user stories can start

---

## Phase 3: User Story 1 - Developer runs the whole store locally (Priority: P1) 🎯 MVP

**Goal**: `pnpm install && pnpm bootstrap && pnpm dev` gives a running backend, Admin and storefront listing seeded products from the backend

**Independent Test**: quickstart V1 — `/health`, `/status`, `/app` and `http://localhost:8000/pl` respond; ≥ 6 "(test)" products with PLN prices are listed; second `pnpm seed` creates nothing

### Tests for User Story 1

- [ ] T013 [P] [US1] Integration test `apps/backend/integration-tests/http/status.spec.ts` with `medusaIntegrationTestRunner`: `GET /status` returns `200` and body `{ status: "ok", checks: { database: "ok" } }` per `specs/001-project-skeleton/contracts/http-api.md`
- [ ] T014 [P] [US1] Integration test `apps/backend/integration-tests/http/seed.spec.ts`: running the seed twice leaves exactly one region "Polska", one sales channel "Sklep internetowy", 2 categories and ≥ 6 products whose `handle` starts with `test-`
- [ ] T015 [P] [US1] Integration test `apps/backend/integration-tests/http/store-products.spec.ts`: `GET /store/products?fields=id,title,handle,thumbnail,*variants.calculated_price,+catering_info.*&region_id=<Polska>` with the seeded publishable key returns products with `catering_info.min_quantity`, `pricing_unit`, `allergens`, `ingredients` and `calculated_price.currency_code === "pln"`
- [ ] T016 [P] [US1] Module test `apps/backend/src/modules/catering/__tests__/service.spec.ts`: creating catering info with `min_quantity` not a multiple of `quantity_step` is rejected; valid input is stored

### Implementation for User Story 1

- [ ] T017 [US1] Create the `catering` module in `apps/backend/src/modules/catering/` (`index.ts`, `service.ts`, `models/catering-product-info.ts`) with model `catering_product_info`: `id` (id, prefix `cpi`), `min_quantity` (integer, "≥ 1; default 1"), `quantity_step` (integer, "≥ 1; default 1"), `pricing_unit` (enum `piece` | `portion` | `person`, required), `ingredients` (text, "required, non-empty (Polish)"), `allergens` (array of enum `gluten`, `crustaceans`, `eggs`, `fish`, `peanuts`, `soybeans`, `milk`, `nuts`, `celery`, `mustard`, `sesame`, `sulphites`, `lupin`, `molluscs`; "may be empty; unique values"), `dietary_tags` (array of enum `vegetarian` | `vegan` | `gluten_free` | `lactose_free`, "may be empty"); service enforces "`min_quantity` MUST be a multiple of `quantity_step`"; register the module in `apps/backend/medusa-config.ts`
- [ ] T018 [US1] Define the one-to-one module link product ↔ catering_product_info with cascade delete in `apps/backend/src/links/product-catering.ts`, then generate and run migrations (`medusa db:generate catering`, `pnpm db:migrate`)
- [ ] T019 [P] [US1] Implement `GET /status` in `apps/backend/src/api/status/route.ts`: runs `SELECT 1` with a 500 ms timeout; returns `200 {status:"ok", version, environment: APP_ENV, checks:{database:"ok"}}` or `503` with `status:"degraded"` and `database:"error"`
- [ ] T020 [P] [US1] Add 6 placeholder product images `apps/backend/static/placeholders/1.svg` … `6.svg` (simple neutral SVGs labelled "Zdjęcie testowe")
- [ ] T021 [US1] Replace `apps/backend/src/scripts/seed.ts` with an idempotent seed (each entity looked up by its stable key from `specs/001-project-skeleton/data-model.md` and created only if missing): store default currency `pln`; region "Polska" (`pl`, `pln`, provider `pp_system_default`); tax region `pl` default rate 8; price preference `pln` tax-inclusive; sales channel "Sklep internetowy" + publishable key "Storefront" (print its token); stock location "Kuchnia La Palette" with manual fulfillment; categories `finger-food` "Finger food" and `desery` "Desery"; 6 fictional products (3 per category), `handle` prefixed `test-`, `title` ending "(test)", status `published`, one variant with a gross PLN price, `manage_inventory=false`, `thumbnail` `${MEDUSA_BACKEND_URL}/static/placeholders/<n>.svg`, each with linked catering info; log counts of created vs existing entities
- [ ] T022 [US1] Point the starter at the backend: in `apps/storefront` make `pl` the default country/region (middleware/region lookup uses `NEXT_PUBLIC_DEFAULT_REGION`), and allow the backend host for `next/image` in `apps/storefront/next.config.ts`
- [ ] T023 [US1] Make the storefront home `apps/storefront/src/app/[countryCode]/(main)/page.tsx` render a product grid of up to 24 products from `GET /store/products` (fields per `contracts/http-api.md`) showing name, thumbnail and gross PLN price; use a short revalidation so Admin price edits appear on reload
- [ ] T024 [US1] Add a backend-unavailable state: fetch timeout of 5 s in the storefront Medusa client (`apps/storefront/src/lib/config.ts` or equivalent) and `apps/storefront/src/app/[countryCode]/(main)/error.tsx` showing "Sklep jest chwilowo niedostępny" with a retry button, keeping header/footer rendered
- [ ] T025 [US1] Run `pnpm test:integration` (T013–T016) against the dev Postgres server and confirm no `medusa-*-integration-*` databases are left behind

**Checkpoint**: MVP — the store runs locally with real backend data

---

## Phase 4: User Story 2 - Store operator logs into the admin panel (Priority: P1)

**Goal**: Staff log into Admin and see Poland/PLN/VAT configured; staging never accepts local credentials

**Independent Test**: quickstart V2 — login as `admin@lapalette.local` locally; region, tax and prices visible; a price edit shows up on the storefront

### Tests for User Story 2

- [ ] T026 [P] [US2] Integration test `apps/backend/integration-tests/http/admin-seed.spec.ts`: with `APP_ENV=local` the seed creates `admin@lapalette.local`; with `APP_ENV=staging` and no `ADMIN_EMAIL`/`ADMIN_PASSWORD` the seed throws and creates no admin; with them set it creates that admin and never `admin@lapalette.local`

### Implementation for User Story 2

- [ ] T027 [US2] Add admin-user creation to `apps/backend/src/scripts/seed.ts` using Medusa's user + auth identity workflows: `APP_ENV=local` → email `admin@lapalette.local`, password `lapalette-local`; any other `APP_ENV` → require `ADMIN_EMAIL` and `ADMIN_PASSWORD`, else exit non-zero with "ADMIN_EMAIL/ADMIN_PASSWORD required outside local"; idempotent by email
- [ ] T028 [US2] Verify in Admin (`http://localhost:9000/app`) that region "Polska" is the default with PLN, tax region PL 8% and tax-inclusive PLN prices; edit one "(test)" product price and confirm the storefront shows the new gross price after reload (quickstart V2)

**Checkpoint**: US1 + US2 work independently

---

## Phase 5: User Story 3 - Customer sees a branded storefront shell (Priority: P2)

**Goal**: La Palette Garden look (logo, colours, fonts), Polish texts, legal placeholders, usable from 360 px

**Independent Test**: quickstart V3

### Tests for User Story 3

- [ ] T029 [P] [US3] Unit test `apps/storefront/tests/unit/format-price.test.ts` (run with `node --test`) for the PLN formatter in `apps/storefront/src/lib/util/format-pln.ts`: `89` → "89,00 zł" (Polish locale, gross)

### Implementation for User Story 3

- [ ] T030 [P] [US3] Create `apps/storefront/src/styles/theme.css` with a Tailwind 4 `@theme` block holding exactly: `--color-brown-super-light: #836b5e`, `--color-brown-light: #836b5e`, `--color-brown-black: #322a2a`, `--color-brown-dark: #3f3232`, `--color-brown-button: #6f5141`, `--color-beige-dark: #ded6cf`, `--color-beige-light: #faf7f2`, `--color-green-dark: #2f422e`, `--color-separator: hsla(21, 26%, 35%, 0.2)` (source: `/Users/maciejrusek/git/la-palette-garden/src/app/globals.css`); import it from the storefront global CSS and set body background `var(--color-beige-light)`
- [ ] T031 [P] [US3] Copy Switzer woff2 files (Light 300, Regular 400, Medium 500, Bold 700) from `/Users/maciejrusek/git/la-palette-garden/src/app/fonts/switzer/` to `apps/storefront/src/fonts/switzer/`; in `apps/storefront/src/app/layout.tsx` load Switzer via `next/font/local` (body) and Instrument Serif 400 normal/italic via `next/font/google` (headings), set `<html lang="pl">`
- [ ] T032 [P] [US3] Copy brand assets from `/Users/maciejrusek/git/la-palette-garden/public/` (`logo-kolor-1.svg`, `logo-bialy-1.svg`, `logo-small.svg`, one hero image such as `intro2.webp` + `intro2-mobile.webp`) to `apps/storefront/public/brand/`
- [ ] T033 [P] [US3] Create `apps/storefront/src/i18n/pl.ts`: a typed object with every shell text (navigation, footer company details, legal link labels, home hero copy, "Sklep jest chwilowo niedostępny", product card labels) and an allergen label map for the 14 allergen codes
- [ ] T034 [P] [US3] Implement the PLN formatter `apps/storefront/src/lib/util/format-pln.ts` (Intl `pl-PL`, currency `PLN`) and use it in the product grid (T023)
- [ ] T035 [US3] Restyle the starter layout in `apps/storefront/src/modules/layout/` (header with logo + navigation placeholders, footer with company details and links to `/pl/regulamin` and `/pl/polityka-prywatnosci`) using only theme tokens and texts from `src/i18n/pl.ts`; hide cart and account links until their features ship
- [ ] T036 [US3] Add the hero section (brand image, Instrument Serif heading) above the product grid in `apps/storefront/src/app/[countryCode]/(main)/page.tsx`, texts from `src/i18n/pl.ts`
- [ ] T037 [P] [US3] Add placeholder pages `apps/storefront/src/app/[countryCode]/(main)/regulamin/page.tsx` and `apps/storefront/src/app/[countryCode]/(main)/polityka-prywatnosci/page.tsx` ("Treść w przygotowaniu"), texts from `src/i18n/pl.ts`
- [ ] T038 [US3] Grep `apps/storefront/src/modules/layout`, `apps/storefront/src/app/[countryCode]/(main)` and product-grid components for hex/rgb colour literals and hard-coded Polish/English strings; move any found into `theme.css` or `src/i18n/pl.ts`; check `/pl` at 360 px for no horizontal scroll

**Checkpoint**: US1–US3 work; storefront looks like La Palette Garden

---

## Phase 6: User Story 4 - Every change is verified and deployed to staging (Priority: P2)

**Goal**: Minimal CI without DB; automatic staging deploy from `main` after CI; staging public but not indexed

**Independent Test**: quickstart V4 + V5

### Tests for User Story 4

- [ ] T039 [P] [US4] Backend unit test `apps/backend/src/modules/catering/__tests__/validate.unit.spec.ts` (Jest `test:unit`, no DB) for the pure `min_quantity`/`quantity_step` validation helper extracted from the service in T017
- [ ] T040 [P] [US4] Playwright smoke test `apps/storefront/e2e/smoke.spec.ts` + `apps/storefront/playwright.config.ts` (local only, no webServer auto-start): open `http://localhost:8000/pl`, assert at least one product title containing "(test)" and a "zł" price, run `@axe-core/playwright` with tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` and assert zero violations

### Implementation for User Story 4

- [ ] T041 [US4] Wire `test:unit` scripts: backend Jest unit (scaffold `TEST_TYPE=unit` config), storefront `node --test tests/unit/`; root `pnpm test:unit` runs both and needs no database or env vars
- [ ] T042 [US4] Create `/.github/workflows/ci.yml`: one job on `pull_request` and `push` to `main`, Node 24, Corepack pnpm, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build` with placeholder build-time env values; no services, no secrets; target < 5 min
- [ ] T043 [P] [US4] Backend no-index header: `apps/backend/src/api/middlewares.ts` adds `X-Robots-Tag: noindex, nofollow` to every response when `ALLOW_INDEXING !== "true"`
- [ ] T044 [P] [US4] Storefront no-index: `apps/storefront/src/app/robots.ts` returns `Disallow: /` when `ALLOW_INDEXING !== "true"`; `apps/storefront/next.config.ts` adds the `X-Robots-Tag: noindex, nofollow` header; root layout metadata sets `robots: { index: false, follow: false }` in that case
- [ ] T045 [US4] Extend `apps/backend/package.json` `predeploy` to `medusa db:migrate && medusa exec ./src/scripts/seed.js` (runs inside `.medusa/server` on Railway) and confirm the built seed path exists after `pnpm --filter backend build`
- [ ] T046 [US4] **Blocked on user**: create GitHub remote and push `main` (requires `gh auth login` or an authorised SSH key)
- [ ] T047 [US4] **Blocked on user `railway login` or dashboard**: create empty Railway environment `staging` in project `la-palette-store` (`railway environment new staging`, no duplicate), deploy the `postgres` template into it with `POSTGRES_DB=lapalette`
- [ ] T048 [US4] In Railway `staging`, create service `backend` from the GitHub repo: root directory `apps/backend`, build `pnpm install --frozen-lockfile && pnpm build`, start `cd .medusa/server && npm install && npm run predeploy && npm run start`, health check `/health`, "Wait for CI" on, variables per `contracts/configuration.md` (`APP_ENV=staging`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, random `JWT_SECRET`/`COOKIE_SECRET`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` provided by the user, `MEDUSA_WORKER_MODE=shared`, `DISABLE_MEDUSA_ADMIN=false`, `ALLOW_INDEXING=false`, CORS values), generate a Railway domain and set `MEDUSA_BACKEND_URL` to it
- [ ] T049 [US4] In Railway `staging`, create service `storefront` from the GitHub repo: root `apps/storefront`, build `pnpm install --frozen-lockfile && pnpm build`, start `pnpm start`, "Wait for CI" on, variables `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (from the staging seed log), `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_DEFAULT_REGION=pl`, `ALLOW_INDEXING=false`; generate a domain and update backend `STORE_CORS`/`AUTH_CORS`
- [ ] T050 [US4] Validate staging per quickstart V5: merge to `main` → live < 15 min; `/status` 200; local credentials rejected; `X-Robots-Tag` present; a CI failure leaves the previous deployment running

**Checkpoint**: All stories complete

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T051 [P] Write `/README.md`: prerequisites (Node 24, Corepack, internet, Railway dev DB URL — no Docker/Redis), the 3 local commands, local addresses, seed/test commands, staging overview, pointers to `specs/001-project-skeleton/quickstart.md`
- [ ] T052 [P] Add placeholder READMEs for future extension areas (FR-014): `apps/backend/src/modules/payment-przelewy24/README.md`, `apps/backend/src/workflows/README.md`, `apps/backend/src/subscribers/README.md`, `apps/backend/src/admin/README.md` (note: React 18)
- [ ] T053 Update `specs/001-project-skeleton/plan.md` Complexity Tracking with the final outcome of T003/T004 (remove conditional rows that did not materialise)
- [ ] T054 Run the full quickstart V1–V4 locally (`pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build`, then `pnpm test:integration` and `pnpm test:e2e`) and do the constitution self-review checklist (Principles I–VII, stack, workflow) before merging

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001–T006)** → **Foundational (T007–T012)** → user stories
- **US1 (P1)**: after Foundational — the MVP
- **US2 (P1)**: after US1's seed (T021) — extends the same seed file
- **US3 (P2)**: after T022–T023 (storefront wired to backend); independent of US2
- **US4 (P2)**: T039–T045 after Setup/Foundational; T046–T050 need US1–US3 merged and user actions (GitHub remote, Railway login)
- **Polish**: after the stories it documents

### Within stories

- Tests first (they fail), then models → services/routes → seed → storefront
- T017 → T018 → T021 (seed needs module + link); T021 → T027

### Parallel opportunities

- Setup: T005, T006
- Foundational: T007, T008
- US1: T013–T016 together; T019, T020 alongside T017/T018
- US3: T029–T034 and T037 together, then T035 → T036 → T038
- US4: T039, T040, T043, T044 together
- Polish: T051, T052

## Parallel Example: User Story 1

```text
T013 status.spec.ts | T014 seed.spec.ts | T015 store-products.spec.ts | T016 service.spec.ts
then: T017 catering module ‖ T019 /status route ‖ T020 placeholder SVGs
```

## Implementation Strategy

### MVP first (US1)

1. Phases 1–2 (scaffold, latest majors, dev DB connectivity)
2. Phase 3 (US1) → validate quickstart V1 → **stop and demo locally**

### Incremental delivery

1. + US2 (admin/Poland) → quickstart V2
2. + US3 (brand shell) → quickstart V3
3. + US4 (CI + staging) once GitHub remote and Railway staging exist → V4, V5
4. Polish → self-review → merge

### Notes

- Keep it minimal (Constitution VII): no Redis, no Docker, no extra tools beyond this list
- Commit after each task or logical group; never commit `.env`
