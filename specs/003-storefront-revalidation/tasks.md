# Tasks: Storefront Catalog Revalidation

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[contracts/revalidate.md](contracts/revalidate.md)

## Phase 1: Research

- [x] T001 Verify emitted events for product, variant/price, category, region and catering info
  in Medusa 2.21.1 sources (research.md R-01..R-04)
- [x] T002 Runtime-check `query.graph` traversal variant → product and catering info → product on
  the dev DB

## Phase 2: User Story 1 + 2 (P1)

- [x] T003 [US1][US2] Helper `apps/backend/src/lib/storefront-revalidation.ts`: mapping, handle
  resolution, dedupe/limit, 1 s batch, HTTP with 5 s timeout and log-only errors
- [x] T004 [US1][US2] Unit tests `apps/backend/src/lib/__tests__/storefront-revalidation.unit.spec.ts`
- [x] T005 [US1] Subscriber `apps/backend/src/subscribers/storefront-revalidation.ts`
- [x] T006 [US1] Explicit revalidation at the end of `apps/backend/src/scripts/seed-catalog.ts`
- [x] T007 Document env vars in `apps/backend/.env.template` and
  `specs/001-project-skeleton/contracts/configuration.md`

## Phase 3: Housekeeping

- [x] T008 Fix `apps/backend/static/placeholders/2.svg` text colour (and `1.svg` invalid fill)
- [x] T009 `specs/001-project-skeleton/contracts/http-api.md`: batch catering-info note + link
- [x] T010 `apps/backend/AGENTS.md` with the revalidation contract
- [x] T011 Constitution TODO(FRONTEND_HOSTING) — none exists (research R-06)

## Phase 4: Verification

- [x] T012 `pnpm run lint`, `pnpm run test:unit`, `pnpm run typecheck`
- [ ] T013 Manual end-to-end check per [quickstart.md](quickstart.md) (needs the storefront secret)
- [ ] T014 Set `CATERING_REVALIDATE_URL` / `CATERING_REVALIDATE_SECRET` on Railway (staging,
  production)
