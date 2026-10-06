# Implementation Plan: Pickup Scheduling

**Branch**: `004-pickup-scheduling` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-pickup-scheduling/spec.md`

## Summary

Customers choose a pickup date and hourly window; only terms that respect the weekly windows,
blocked dates, a lead time, a booking horizon and a kitchen-wide daily capacity (orders/day)
are offered. The catering module gains five models (settings, per-method schedule, window
rules, blocked dates, bookings). The storefront reads availability from
`GET /store/catering/slots` and stores the term in `cart.metadata.catering_term`, which Medusa
copies to the order. The existing `completeCartWorkflow.hooks.validate` handler re-checks the
term and, under a per-date lock, creates a booking row (compensated if completion fails later),
so the last place can never be sold twice. Staff manage schedule/blocks and see a pickup
calendar in Admin routes, and reschedule orders from an order widget (with confirmable
warnings). See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript (backend on ^6.0.3, strict null checks), Node.js 20+/24

**Primary Dependencies**: Medusa 2.21.1 (`@medusajs/framework`, core-flows, admin-sdk,
`@medusajs/ui` 4.2.5); no new dependencies (time zone via `Intl`, R-05)

**Storage**: PostgreSQL (Railway) — new tables in the catering module, one migration

**Testing**: Jest — unit (`src/**/__tests__/*.unit.spec.ts`, no DB) and HTTP integration
(`integration-tests/http/`, Medusa test runner against the dev DB)

**Target Platform**: Medusa server on Railway (Linux), Medusa Admin (browser)

**Project Type**: web service (Medusa backend) + Admin extensions

**Performance Goals**: slots for 62 days computed in one request with ≤ 4 DB queries;
negligible at < 100 orders/day

**Constraints**: Europe/Warsaw everywhere incl. DST; per-date lock held only for count+insert
(< 1 s); single process in dev/staging (in-memory locking), Redis locking in production

**Scale/Scope**: one venue, ~10 orders/day, horizon ≤ 365 days

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / rule | Status | Notes |
|---|---|---|
| I. Medusa-native | ✅ | custom module models, workflows for mutations, subscribers, API routes, `validate` hook, Admin routes/widgets; no core patches |
| II. Ordering UX | ✅ | date + slot for pickup, lead time / blocked dates / capacity enforced by backend; `method` field keeps the fulfillment-method step open for delivery |
| III. Brand | n/a | storefront UI lives in la-palette-garden |
| IV. Consumer law | ✅ | no change to prices; term shown on order |
| V. Mobile/a11y | n/a here | storefront; contract returns everything needed for an accessible picker |
| VI. Tested critical paths | ✅ | unit: availability + DST; HTTP: slots, rejection, concurrent last place, cancel frees place |
| VII. Simplicity | ✅ | no new service/dependency; booking row instead of a reservation service; capacity per day only |
| VIII. Backend source of truth + contracts | ✅ | completion re-checks all rules; [contracts/store-api.md](contracts/store-api.md) |
| Stack: Redis only in prod | ✅ | locking uses the built-in provider locally, Redis in prod |
| Stack: latest versions | ✅ | owner decision 2026-10-06: TypeScript stays on 6; Medusa patch/minor releases (2.21.2) are not tracked per feature |
| Workflow: contracts before implementation | ✅ | this plan |

**Post-design re-check**: unchanged — design adds no service, dependency or abstraction beyond
the module models and one pure availability function.

## Project Structure

### Documentation (this feature)

```text
specs/004-pickup-scheduling/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── store-api.md     # for la-palette-garden
│   └── admin-api.md     # for this repo's Admin extensions
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
apps/backend/
├── src/modules/catering/
│   ├── models/                      # + scheduling-settings, fulfillment-schedule,
│   │                                #   window-rule, blocked-date, booking
│   ├── migrations/                  # + one generated migration
│   ├── scheduling/
│   │   ├── time.ts                  # Warsaw wall-clock ↔ instant, weekday, today
│   │   ├── availability.ts          # pure computeAvailability (R-08)
│   │   ├── term.ts                  # parse/validate catering_term, Polish messages
│   │   └── __tests__/*.unit.spec.ts
│   └── service.ts                   # + generated CRUD for new models
├── src/workflows/
│   ├── hooks/complete-cart-validate.ts   # + term check, locked booking, compensation
│   ├── update-pickup-schedule.ts
│   ├── block-date.ts / unblock-date.ts
│   └── reschedule-order-pickup.ts        # booking + order.metadata
├── src/subscribers/
│   ├── pickup-booking-order-placed.ts    # order.placed → booking.order_id
│   └── pickup-booking-order-canceled.ts  # order.canceled → booking canceled
├── src/api/store/catering/slots/route.ts
├── src/api/admin/catering/{schedule,blocked-dates,blocked-dates/[id],calendar,orders/[id]/pickup-term}/route.ts
├── src/api/middlewares.ts            # + query/body validators for the new routes
├── src/admin/
│   ├── routes/pickups/page.tsx                  # "Odbiory" calendar (sidebar)
│   ├── routes/settings/pickup-schedule/page.tsx # schedule, capacity, blocked dates
│   └── widgets/order-pickup-term.tsx            # term + reschedule
├── src/scripts/setup-pickup-schedule.ts          # default schedule, called from seed.ts
├── integration-tests/http/pickup-scheduling.spec.ts
└── AGENTS.md                         # "Kontrakty dla storefrontu" → link to contracts/store-api.md
```

**Structure Decision**: single Medusa backend (`apps/backend`); scheduling logic as a
sub-folder of the existing catering module so pure functions are unit-testable and shared by
the Store route, the completion hook and the Admin routes.

## Complexity Tracking

No violations.
