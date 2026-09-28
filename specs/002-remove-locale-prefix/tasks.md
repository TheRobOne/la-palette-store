---

description: "Task list for 002-remove-locale-prefix"
---

# Tasks: Remove Locale/Country Code from Storefront URLs

**Input**: Design documents from `/specs/002-remove-locale-prefix/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/routes.md, quickstart.md

**Tests**: No new test framework — this feature is verified by the storefront's existing
lint/typecheck/build/unit and Playwright smoke test (unchanged), plus the manual checks in
quickstart.md. No new test tasks are generated (spec.md does not request TDD and there is
no new business logic — see research R-04).

**Organization**: A single user story (US1, P1) — every task in Phase 3 delivers it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (the only story)
- Paths are relative to `apps/storefront/src` unless stated otherwise

## Global rules for every task

- FR-006: no page's rendered content or behaviour may change — only its address.
- Every edited call site loses its `countryCode` parameter/argument entirely; do not
  replace it with a hard-coded `"pl"` string anywhere (constitution VII — the single
  region stays configured once, in `lib/data/regions.ts`, per research R-02).
- Leave `modules/checkout/components/country-select` untouched — it is an address-form
  country `<select>`, unrelated to URL routing (research R-03).

---

## Phase 1: Setup

- [X] T001 Confirm the baseline: with the local environment running (per
  `specs/001-project-skeleton/quickstart.md` V1), open `http://localhost:8000/` and note
  that it currently 307-redirects to `/pl` — this is the behaviour Phase 2 removes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Move the route tree and simplify region resolution — every task in Phase 3
depends on both

**⚠️ CRITICAL**: No Phase 3 task can begin until this phase is complete

- [X] T002 Move the route tree: `git mv apps/storefront/src/app/[countryCode]/(main)
  apps/storefront/src/app/(main)` and `git mv apps/storefront/src/app/[countryCode]/(checkout)
  apps/storefront/src/app/(checkout)`, then remove the now-empty
  `apps/storefront/src/app/[countryCode]` directory
- [X] T003 Simplify `apps/storefront/src/middleware.ts`: delete `getRegionMap`,
  `getCountryCode` and the country-detection/redirect branch in `middleware()`; keep only
  the `_medusa_cache_id` cookie bootstrap (read the existing cookie, generate one with
  `crypto.randomUUID()` if missing, set it with `maxAge: 60 * 60 * 24` on the response,
  call `NextResponse.next()`); leave the exported `config.matcher` as-is
- [X] T004 Simplify `apps/storefront/src/lib/data/regions.ts`: replace `getRegion(countryCode)`
  with a zero-argument `getRegion()` that calls `listRegions()`, finds the region whose
  `countries` include `process.env.NEXT_PUBLIC_DEFAULT_REGION` (falling back to the first
  region if none matches, matching the old fallback behaviour), and caches the resolved
  region in a module-level variable (replacing the old country-code-keyed `Map`); remove
  `retrieveRegion` only if nothing outside this file still calls it (check first)

**Checkpoint**: `getRegion()` and the route tree are in their final shape; every
remaining task is a mechanical caller update

---

## Phase 3: User Story 1 - Visitor browses the shop with clean, locale-free URLs (Priority: P1) 🎯 MVP

**Goal**: every storefront address has no locale/country segment; every internal link
points to a locale-free address; no page's content or behaviour changes (FR-001–FR-006)

**Independent Test**: quickstart.md V1 — open `/`, a product page, `/regulamin`; confirm
no address or on-page link contains a locale segment

### Update the data layer (no UI dependency, safe to parallelize)

- [X] T005 [P] [US1] `apps/storefront/src/lib/data/products.ts`: in `listProducts`, drop
  the `countryCode` parameter; keep the `regionId` parameter; when neither is passed by a
  caller, resolve the region via `getRegion()` (no argument, per T004)
- [X] T006 [P] [US1] `apps/storefront/src/lib/data/cart.ts`: drop the `countryCode`
  parameter from `getOrSetCart` and any function that takes it, calling `getRegion()`
  instead of `getRegion(countryCode)`; in every `redirect(...)` call, drop the
  `/${countryCode}` prefix from the target path (including in `updateRegion`, which keeps
  its `currentPath` argument but no longer needs a `countryCode` one — check its callers
  and update them too)
- [X] T007 [P] [US1] `apps/storefront/src/lib/data/customer.ts`: drop the `countryCode`
  parameter from `signout` and drop the `/${countryCode}` prefix from its `redirect(...)`
  target
- [X] T008 [P] [US1] `apps/storefront/src/app/api/payment-return/route.ts`: drop the
  `/${countryCode}` prefix from its `redirect()`/response target

### Update `LocalizedClientLink` (self-contained; many components below call it unchanged)

- [X] T009 [US1] `apps/storefront/src/modules/common/components/localized-client-link/index.tsx`:
  remove the `useParams()` call and the `countryCode` prefix; render `<Link href={href} {...props}>{children}</Link>`
  directly (keep the component and its prop signature so callers need no change)

### Update pages under the moved route tree

- [X] T010 [US1] `apps/storefront/src/app/(main)/page.tsx`: remove `countryCode` from the
  destructured route `params`; replace `getRegion(countryCode)` with `getRegion()`
- [X] T011 [P] [US1] `apps/storefront/src/app/(main)/store/page.tsx`: same change as T010
  (drop `countryCode` from params, call `getRegion()`/`listProducts()` without it)
- [X] T012 [P] [US1] `apps/storefront/src/app/(main)/categories/[...category]/page.tsx`:
  same change as T010
- [X] T013 [P] [US1] `apps/storefront/src/app/(main)/collections/[handle]/page.tsx`: same
  change as T010
- [X] T014 [P] [US1] `apps/storefront/src/app/(main)/products/[handle]/page.tsx`: same
  change as T010; its `generateStaticParams` (already wrapped in try/catch, per
  001-project-skeleton) drops the per-country-code loop and calls `listProducts()` once
  for the single region
- [X] T015 [P] [US1] `apps/storefront/src/app/(main)/account/@dashboard/addresses/page.tsx`:
  remove its `countryCode` usage (route param and/or any `redirect`/link built from it)

### Update components that read `countryCode` directly

- [X] T016 [P] [US1] `apps/storefront/src/modules/account/components/account-nav/index.tsx`:
  remove `useParams().countryCode` and any use of it (e.g. a `signout()` call — update to
  the new no-argument signature from T007)
- [X] T017 [P] [US1] `apps/storefront/src/modules/categories/templates/index.tsx`: remove
  its `countryCode` usage
- [X] T018 [P] [US1] `apps/storefront/src/modules/collections/templates/index.tsx`:
  remove its `countryCode` usage
- [X] T019 [P] [US1] `apps/storefront/src/modules/products/templates/index.tsx`: remove
  its `countryCode` usage
- [X] T020 [P] [US1] `apps/storefront/src/modules/products/components/product-actions/index.tsx`:
  remove its `countryCode` usage
- [X] T021 [P] [US1] `apps/storefront/src/modules/products/components/related-products/index.tsx`:
  remove its `countryCode` usage (likely passed into `listProducts`/`getRegion` — align
  with T005/T004)
- [X] T022 [P] [US1] `apps/storefront/src/modules/store/templates/paginated-products.tsx`:
  remove its `countryCode` usage
- [X] T023 [P] [US1] `apps/storefront/src/modules/checkout/components/payment-button/index.tsx`:
  remove its `countryCode` usage and any `/${countryCode}` prefix in a redirect/link it
  builds after payment

### Remove dead code (research R-03)

- [X] T024 [P] [US1] Delete `apps/storefront/src/modules/layout/components/side-menu/`,
  `apps/storefront/src/modules/layout/components/country-select/` and
  `apps/storefront/src/modules/layout/components/language-select/` (confirm each has zero
  remaining importers before deleting — re-check after T016–T023, since none should import
  them, but a stale import would now be a type/build error surfacing it)

**Checkpoint**: no file in `apps/storefront/src` references `countryCode` or
`[countryCode]` (`grep -rn "countryCode" apps/storefront/src` returns nothing)

---

## Phase 4: Polish & Validation

- [X] T025 Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build` from the repo
  root; fix anything the route move/param removal surfaces (a leftover `countryCode`
  reference becomes a type error now that the segment no longer exists)
- [X] T026 Run `pnpm test:e2e` (Playwright smoke test) against the running local
  environment; confirm it still finds a "(test)" product and a "zł" price with zero axe
  violations, now at `/` (quickstart.md V2)
- [X] T027 Manual pass through quickstart.md V1 and V3: home, a product page,
  `/regulamin`, `/polityka-prywatnosci`, `/cart`, `/checkout`, `/account` all load without
  a locale segment and without any on-page link containing one
- [X] T028 Self-review against the constitution compliance checklist (Principles I–VII,
  stack and workflow rules) before merging, per Development Workflow & Quality Gates

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001)** → **Foundational (T002–T004)** → **US1 (T005–T024)** → **Polish (T025–T028)**
- Nothing in this feature can be delivered incrementally below the single user story —
  the route move (T002) is all-or-nothing, so there is no smaller MVP slice than "the
  whole feature"

### Within US1

- T005–T009 (data layer + `LocalizedClientLink`) have no dependency on T010–T024 and can
  run first or in parallel with them
- T010–T015 (pages) depend on T002 (moved directories) and T004 (`getRegion()`); a page
  that calls `listProducts`/`getOrSetCart` also depends on T005/T006 being done first if
  edited in the same pass (or fix twice — cheaper to sequence T005–T009 before T010+)
- T016–T023 (components) depend on T009 (`LocalizedClientLink`) only if they also render
  one; otherwise independent
- T024 (delete dead files) should run last within US1, after confirming no new importer
  appeared

## Parallel Example: Phase 3 data layer

```text
T005 lib/data/products.ts | T006 lib/data/cart.ts | T007 lib/data/customer.ts | T008 app/api/payment-return/route.ts
```

## Parallel Example: Phase 3 pages + components (after T002–T009)

```text
T011 store/page.tsx | T012 categories/.../page.tsx | T013 collections/.../page.tsx | T014 products/.../page.tsx | T015 addresses/page.tsx
T017 categories/templates | T018 collections/templates | T019 products/templates | T020 product-actions | T021 related-products | T022 paginated-products | T023 payment-button
```

## Implementation Strategy

Do Phase 1–2 first (they block everything), then Phase 3's data-layer tasks (T005–T009),
then the page/component tasks in parallel, then T024 last. Finish with Phase 4. Commit
once at the end of Phase 3 (checkpoint: `grep -rn "countryCode"` is empty) rather than
per-task — the tree only compiles again once every caller of the old signatures is
updated.

### Notes

- Keep it minimal (Constitution VII): no new dependency, no redirect shim for old `/pl`
  addresses (spec.md Assumptions).

## Implementation Notes (found during T025–T027, not anticipated in the original plan)

- Three relative `i18n/pl` imports under `app/(main)/` (`error.tsx`,
  `regulamin/page.tsx`, `polityka-prywatnosci/page.tsx`) hard-coded a `../` depth that
  matched the old `[countryCode]/(main)/...` nesting; fixed after the move (one level
  shallower).
- Removing `[countryCode]` made `/store`, `/` and the whole `/account/*` subtree eligible
  for build-time static prerendering for the first time (they were implicitly dynamic
  before, nested under a dynamic segment). Each fetches live backend data, so a CI build
  (no real backend/key, per constitution) failed prerendering them:
  - `app/(main)/store/page.tsx` and `app/(main)/account/layout.tsx` (covering its whole
    subtree) now export `const dynamic = "force-dynamic"`.
  - `app/(main)/page.tsx` (home) wraps its fetch in try/catch, falling back to the
    hero-only shell **only** when `process.env.NEXT_PHASE === "phase-production-build"**
    (Next's build-time signal) — a genuine runtime backend outage still throws and is
    caught by `error.tsx`, per spec Edge Cases (unchanged behaviour, FR-006).
- `apps/storefront/e2e/smoke.spec.ts` still navigated to `/pl`; updated to `/`.
