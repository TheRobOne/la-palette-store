# Implementation Plan: On-Request Pickup Terms

**Branch**: `005-on-request-terms` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-on-request-terms/spec.md`

## Summary

Staff mark pickup windows as "on request". For such a window the customer sends a request
(`POST /store/catering/requests`) without paying: the cart stays a cart, and a 004 booking is
created in state `requested` under the per-date capacity lock, with a response deadline and a
snapshot of the cart. Staff confirm or decline in the Admin; confirmation sets a payment
deadline. The customer then pays the same cart through the normal checkout and
`complete` — the existing `validate` hook accepts an on-request term only for a confirmed,
unexpired, unchanged request and turns the booking `active`. A scheduled job expires
unanswered and unpaid requests. Rationale for "request = cart, order on payment": Medusa can
only create an order from a cart with a payment session, and the Store API pays only carts
([research.md](research.md) R-01).

## Technical Context

**Language/Version**: TypeScript (^6, strict null checks), Node.js 20+/24

**Primary Dependencies**: Medusa 2.21.1 (framework, core-flows, admin-sdk, `@medusajs/ui`);
no new dependencies

**Storage**: PostgreSQL — catering module models extended (one migration)

**Testing**: Jest unit (pure state/deadline/snapshot logic) + HTTP integration

**Target Platform**: Medusa server on Railway + Medusa Admin

**Project Type**: web service + Admin extensions

**Performance Goals**: negligible load (< 20 requests/day); expiry job every 5 min

**Constraints**: Europe/Warsaw deadlines (004 helpers); capacity changes only under
`catering:capacity:<date>`; payment always re-checks deadlines (job may lag ≤ 15 min, SC-001)

**Scale/Scope**: one venue, single process (in-memory locking/event bus in dev/staging)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / rule | Status | Notes |
|---|---|---|
| I. Medusa-native | ✅ | module models, workflows for confirm/decline, scheduled job, Store/Admin routes, existing `validate` hook; no core patch; no fake payment provider |
| II. Ordering UX (incl. On-request terms, 2.3.0) | ✅ | request without payment only for staff-marked windows (FR-003a); clear labels via `requires_confirmation`; capacity held; deadlines; confirm/decline only; all params in Admin |
| III. Brand | n/a | storefront in la-palette-garden |
| IV. Consumer law | ✅ | request is not an order; payment happens in the standard checkout step with its legal texts |
| V. Mobile/a11y | n/a here | contract gives all states/labels for an accessible status page |
| VI. Tested critical paths | ✅ | request, confirm, decline, both expiries with capacity release, concurrency, snapshot mismatch |
| VII. Simplicity | ✅ | reuse booking, lock, validators and checkout; Medusa scheduled job instead of timers |
| VIII. Source of truth + contracts | ✅ | backend owns the state machine and refuses wrong paths; [contracts/store-api.md](contracts/store-api.md) non-breaking |
| Version policy (memory) | ✅ | no upgrades |

**Post-design re-check**: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/005-on-request-terms/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── store-api.md
│   └── admin-api.md
└── tasks.md             # /speckit-tasks
```

### Source Code

```text
apps/backend/
├── src/modules/catering/
│   ├── models/window-rule.ts, fulfillment-schedule.ts, booking.ts   # new fields / statuses
│   ├── migrations/                                                  # + one migration
│   └── scheduling/
│       ├── availability.ts          # requires_confirmation per window, request lead time
│       ├── requests.ts              # pure: deadlines, state transitions, expiry selection,
│       │                            #       snapshot build/compare, Polish messages
│       ├── load.ts                  # counts requested+confirmed+active
│       └── __tests__/requests.unit.spec.ts (+ availability additions)
├── src/lib/
│   ├── pickup-booking.ts            # reserve: standard vs on-request branch on completion
│   └── cart-order-checks.ts         # shared cart loading + min order/invoice/term checks
├── src/workflows/
│   ├── hooks/complete-cart-validate.ts   # on-request branch (confirmed → active)
│   ├── send-pickup-request.ts
│   ├── confirm-pickup-request.ts
│   └── decline-pickup-request.ts
├── src/jobs/expire-pickup-requests.ts    # */5 * * * *
├── src/api/store/catering/requests/route.ts           # POST
├── src/api/store/catering/requests/[cart_id]/route.ts # GET
├── src/api/admin/catering/requests/route.ts           # GET list
├── src/api/admin/catering/requests/[id]/{confirm,decline}/route.ts
├── src/api/admin/catering/{schedule,calendar}/route.ts   # extended
├── src/admin/routes/pickup-requests/page.tsx       # "Zapytania"
├── src/admin/routes/settings/pickup-schedule/page.tsx  # toggles + 3 numbers
├── src/admin/routes/pickups/page.tsx               # request badges
├── integration-tests/http/pickup-requests.spec.ts
└── AGENTS.md                                       # Kontrakty dla storefrontu → 005
```

**Structure Decision**: extend the 004 scheduling sub-module; all state rules in one pure,
unit-tested file shared by routes, hook, workflows and the job.

## Complexity Tracking

No violations.
