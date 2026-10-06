# Implementation Plan: Storefront Catalog Revalidation

**Branch**: `003-storefront-revalidation` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

## Summary

One subscriber (`src/subscribers/storefront-revalidation.ts`) listens to product, variant,
category, region and catering-info events, resolves product handles with `query.graph`, and
queues tags in a 1 s in-process batch. One helper (`src/lib/storefront-revalidation.ts`) holds
the event → tag mapping, deduplication, and the HTTP call (5 s timeout, log-only errors,
skipped without env). `seed-catalog` calls the helper directly at the end.

## Technical Context

**Language/Version**: TypeScript, Node 24, Medusa 2.21.1 (unchanged)

**Primary Dependencies**: none new — global `fetch` and `AbortSignal.timeout`

**Storage**: N/A — no data model change

**Testing**: Jest unit tests (`*.unit.spec.ts`, mocked `fetch` and `query`), no database

**Project Type**: backend only

**Constraints**: must not slow down or fail Admin operations; no new infrastructure

## Constitution Check

| Principle / rule | Status | Evidence |
|---|---|---|
| I. Medusa-Native Commerce | PASS | Subscriber + `query.graph`, no core patch |
| II–V (storefront) | N/A | Storefront code out of scope |
| VI. Tested Critical Paths | PASS | Not a checkout path; mapping/HTTP covered by unit tests |
| VII. Simplicity First | PASS | No Redis/queue; in-process 1 s batch only (R-05) |
| VIII. Store API Contracts | PASS | Outbound contract in `contracts/revalidate.md`; `http-api.md` updated |
| Secrets | PASS | Only names in `.env.template`; secret never logged (unit test) |
| Knowledge sources | PASS | Verified in installed Medusa 2.21.1 sources (research.md) |

## Project Structure

```text
apps/backend/
├── .env.template                                  ★ CATERING_REVALIDATE_URL/SECRET
├── AGENTS.md                                      ★ new: revalidation contract summary
├── static/placeholders/{1,2}.svg                  ★ readable colours
└── src/
    ├── lib/storefront-revalidation.ts             ★ mapping, dedupe, batch, HTTP
    ├── lib/__tests__/storefront-revalidation.unit.spec.ts ★
    ├── subscribers/storefront-revalidation.ts     ★
    └── scripts/seed-catalog.ts                    ★ explicit call at the end
specs/001-project-skeleton/contracts/{configuration,http-api}.md ★
```

The helper lives in `src/lib/` because every file in `src/subscribers/` is loaded as a
subscriber.

## Complexity Tracking

*No violations.*
