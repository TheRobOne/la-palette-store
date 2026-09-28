# Implementation Plan: Remove Locale/Country Code from Storefront URLs

**Branch**: `002-remove-locale-prefix` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-remove-locale-prefix/spec.md`

## Summary

Remove the `[countryCode]` dynamic route segment (currently always `pl`) from every
storefront URL. Move `app/[countryCode]/(main)` and `app/[countryCode]/(checkout)` up to
`app/(main)` and `app/(checkout)`; simplify `getRegion()` to a zero-argument lookup of the
single configured Poland region; drop the `countryCode` parameter/prefix from the ~15
call sites that use it (data layer, `redirect()` targets, `LocalizedClientLink`); strip
the now-dead country/locale detection and redirect logic out of `middleware.ts`, keeping
only its unrelated `_medusa_cache_id` cookie bootstrap; delete three files of dead code
uncovered during inspection (`side-menu`, layout `country-select`, `language-select`,
none of which are imported anywhere). Page content and behaviour do not change.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (unchanged from 001-project-skeleton)

**Primary Dependencies**: Next.js 15 App Router, `@medusajs/js-sdk` (unchanged) — no new dependency

**Storage**: N/A — no data model change (data-model.md)

**Testing**: Existing Playwright smoke test (`apps/storefront/e2e/smoke.spec.ts`) re-run
against the new `/` path; existing `pnpm lint`/`typecheck`/`test:unit`/`build`

**Target Platform**: Same as 001-project-skeleton (local dev; staging deferred)

**Project Type**: Web application — storefront-only change (backend untouched)

**Performance Goals**: One fewer redirect hop on every cold entry to `/` (SC-002); no
other performance target

**Constraints**: FR-006 — no page's rendered content or behaviour may change, only its
address

**Scale/Scope**: 1 storefront app; ~20 files touched (2 directories moved, ~15 files
edited to drop a parameter, 3 files deleted); no backend, no database, no new dependency

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / rule | Status | Evidence |
|---|---|---|
| I. Medusa-Native Commerce | N/A | No backend/Medusa change |
| II. Event-Catering UX | PASS | No UX flow changes, only addresses |
| III. Brand Fidelity | PASS | No visual/token change |
| IV. Food & Consumer Law | PASS | No content change (FR-006) |
| V. Mobile-First, Perf, A11y | PASS | Existing axe-audited smoke test re-verifies zero violations post-move |
| VI. Tested Critical Paths | N/A | No critical-path logic touched (cart/checkout content unchanged, only address) |
| VII. Simplicity First | PASS | Net simplification: removes a routing layer, a redirect, and 3 dead files; no new dependency or tool |
| Latest majors (ALWAYS) | PASS | No dependency version change in this feature |
| Knowledge sources | PASS | Pure in-repo refactor; no external Medusa API used |

**Post-design re-check**: PASS — contracts/data-model introduce no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-remove-locale-prefix/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/routes.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

Only `apps/storefront` changes; entries marked ★ are moved, edited or deleted by this
feature.

```text
apps/storefront/src/
├── middleware.ts                          ★ drop country/region detection + redirect
├── app/
│   ├── (main)/                            ★ moved from [countryCode]/(main)
│   │   ├── page.tsx                       ★ getRegion() no longer takes countryCode
│   │   ├── error.tsx
│   │   ├── layout.tsx
│   │   ├── regulamin/page.tsx
│   │   ├── polityka-prywatnosci/page.tsx
│   │   ├── store/page.tsx                 ★
│   │   ├── categories/[...category]/page.tsx  ★
│   │   ├── collections/[handle]/page.tsx  ★
│   │   ├── products/[handle]/page.tsx     ★
│   │   ├── cart/...                       ★ params only
│   │   └── account/...                    ★ params only
│   └── (checkout)/                        ★ moved from [countryCode]/(checkout)
│       └── checkout/page.tsx              ★
├── lib/data/
│   ├── regions.ts                         ★ getRegion() takes no argument
│   ├── products.ts                        ★ drop countryCode param
│   ├── cart.ts                            ★ drop countryCode param/redirect prefix
│   └── customer.ts                        ★ drop countryCode param/redirect prefix
├── modules/
│   ├── common/components/localized-client-link/index.tsx  ★ no prefixing, forwards to next/link
│   ├── account/components/account-nav/index.tsx           ★
│   ├── categories/templates/index.tsx                     ★
│   ├── collections/templates/index.tsx                    ★
│   ├── products/templates/index.tsx                       ★
│   ├── products/components/product-actions/index.tsx      ★
│   ├── products/components/related-products/index.tsx     ★
│   ├── store/templates/paginated-products.tsx              ★
│   ├── checkout/components/payment-button/index.tsx        ★
│   ├── layout/components/side-menu/                        ★ deleted (dead code, R-03)
│   ├── layout/components/country-select/                   ★ deleted (dead code, R-03)
│   └── layout/components/language-select/                  ★ deleted (dead code, R-03)
└── app/api/payment-return/route.ts        ★ redirect target drops /pl
```

**Structure Decision**: In-place move of the two route groups out from under
`[countryCode]`, plus mechanical parameter removal at each call site (research R-02).

## Complexity Tracking

*No violations — this feature only removes code/indirection (Constitution VII), nothing
to justify.*
