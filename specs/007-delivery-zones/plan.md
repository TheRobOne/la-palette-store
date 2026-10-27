# Implementation Plan: City Delivery in Postal-Code Zones

**Branch**: `feat/delivery-zones` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-delivery-zones/spec.md`

## Summary

Add city delivery next to pickup. Zones are our own data (catering module: zone + list of full
`XX-XXX` postal codes, price, optional minimum), matched by a plain code lookup. Medusa gets a second fulfillment set "Dostawa" with **one calculated shipping
option**; a tiny fulfillment provider returns the price our backend puts into the pricing
context through the `setCalculatedShippingPricingContext` hook, so Medusa itself prices and
re-prices the cart on every update. Out-of-zone addresses reuse the 005 request path; staff set
the delivery cost when confirming. The 004 scheduling engine gets the `delivery` method and a
per-window delivery maximum checked under the existing per-date lock. The completion hook
re-checks method, address, zone price, zone minimum and window limit. E-mails and Admin views
branch on the method.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Medusa 2.21.1 (Fulfillment Module + custom fulfillment provider,
cart workflow hooks, Admin SDK routes/widgets); no new npm packages

**Storage**: PostgreSQL — catering module: new `delivery_zone`, `delivery_zone_code`; new
columns on `fulfillment_schedule` and `booking`; enum change for the method (one migration);
store metadata `catering_free_delivery_threshold`

**Testing**: Jest unit tests (postal code validation, zone matching, quote, per-window
availability, e-mail templates per method); HTTP integration test
`integration-tests/http/delivery.spec.ts` (quote, pricing, re-pricing, completion refusals,
out-of-zone request, window limit under concurrency) against the dev PostgreSQL; existing
suites unchanged

**Target Platform**: Railway (staging, later production)

**Project Type**: web service (Medusa backend + Admin extensions); storefront changes in
la-palette-garden follow `contracts/store-api.md`

**Performance Goals**: quote/re-pricing within the normal cart request (< 2 s, SC-001); tens
of orders per day, a handful of zones with up to a few hundred codes

**Constraints**: pickup behaviour unchanged (SC-006); backend source of truth for price and
limits (constitution VIII); no geocoding (constitution, Stack → Fulfillment)

**Scale/Scope**: 1 module provider, 2 models, ~4 Store/Admin routes, 1 Admin page, changes to
~15 existing files (scheduling, booking, requests, completion hook, e-mails, Admin views,
setup)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / rule | Status | Notes |
|---|---|---|
| I. Medusa-native | Pass | Delivery is a Medusa fulfillment set + shipping option; pricing via a fulfillment provider and an official workflow hook; zones table in our module because native `zip` geo zones also require an exact city match, which fails for villages and cross-city zones (research R-01) |
| II. Ordering UX | Pass | Method step, address, price in cart from the postal code, out-of-zone via request, delivery windows/lead time, zones and prices in Admin |
| III. Brand | N/A | No storefront UI here; e-mails reuse the 006 layout |
| IV. Consumer law | Pass | Delivery cost shown before the order / before payment for requests; delivery line in confirmation e-mail |
| V. Mobile/A11y | N/A | Storefront repo |
| VI. Tests | Pass | Zone matching, delivery cost, checkout for both methods, window limit concurrency, out-of-zone request flow (quickstart V1–V9) |
| VII. Simplicity | Pass | No new service or dependency; one option instead of one per zone; reuses lock, booking, request state machine, e-mail templates |
| VIII. Backend truth & contracts | Pass | Completion hook recomputes everything; `contracts/store-api.md`, `admin-api.md`, `emails.md` |
| Stack → Fulfillment | Pass | Amended to v2.4.1 (2026-10-27): price from zones that are lists of full postal codes in the catering module, instead of Medusa `zip` geo zones (R-01) |

**Post-design re-check**: all pass against constitution v2.4.1.

## Project Structure

### Documentation (this feature)

```text
specs/007-delivery-zones/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── store-api.md
│   ├── admin-api.md
│   └── emails.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
apps/backend/
├── medusa-config.ts                         # register catering-delivery fulfillment provider
├── integration-tests/http/delivery.spec.ts  # new
└── src/
    ├── modules/
    │   ├── catering/
    │   │   ├── models/
    │   │   │   ├── fulfillment-schedule.ts  # + "delivery", max_orders_per_window
    │   │   │   ├── booking.ts               # + delivery_* columns, snapshot.delivery
    │   │   │   ├── delivery-zone.ts         # new
    │   │   │   └── delivery-zone-code.ts    # new
    │   │   ├── delivery/                    # new, pure: postal-code.ts, match.ts, quote.ts (+ __tests__)
    │   │   ├── scheduling/availability.ts   # per-window limit, window reason
    │   │   ├── scheduling/load.ts           # bookingsPerWindow, max_orders_per_window
    │   │   ├── scheduling/term.ts           # method-aware messages
    │   │   └── migrations/                  # one new migration
    │   └── catering-delivery/               # new fulfillment provider (calculatePrice from context)
    ├── lib/
    │   ├── delivery.ts                      # load zones/threshold, quote for a cart (I/O wrapper)
    │   ├── cart-order-checks.ts             # delivery checks, needs-confirmation reason
    │   ├── pickup-booking.ts                # store delivery fields, out-of-zone = request
    │   ├── order-rules.ts / min-order-value.ts  # threshold, effective minimum
    │   └── emails/{data.ts,templates/*}     # fulfillment block, wording by method
    ├── workflows/
    │   ├── hooks/delivery-pricing-context.ts    # setCalculatedShippingPricingContext
    │   ├── hooks/complete-cart-validate.ts      # + delivery rules (same single handler)
    │   ├── send-pickup-request.ts               # accept out-of-zone carts
    │   ├── decide-pickup-request.ts             # delivery_cost on confirm + re-price cart
    │   └── save-delivery-zone.ts / delete-delivery-zone.ts   # new
    ├── api/
    │   ├── store/catering/delivery-quote/route.ts           # new
    │   ├── store/catering/order-rules/route.ts              # delivery block
    │   ├── store/catering/requests/[cart_id]/route.ts       # fulfillment block
    │   └── admin/catering/delivery-zones/{route.ts,[id]/route.ts,match/route.ts}  # new
    ├── admin/
    │   ├── routes/settings/delivery-zones/page.tsx          # new
    │   ├── routes/settings/pickup-schedule/page.tsx         # method switch, max per window
    │   ├── routes/pickups/page.tsx, pickup-requests/page.tsx # method, address, cost, confirm dialog
    │   └── widgets/min-order-value.tsx, order-pickup-term.tsx
    └── scripts/
        ├── setup-delivery.ts                # new, called from seed.ts
        └── setup-pickup.ts                  # drop the "non-pickup option" warning
```

**Structure Decision**: everything stays in the existing Medusa backend app; pure rules in the
catering module (unit-testable without a DB, constitution CI rule), I/O wrappers in `src/lib`,
business logic in workflows/hooks per AGENTS.md.

Docs updated in the same PR: `apps/backend/AGENTS.md` ("Fulfillment" and contracts section),
`docs/do-omowienia-z-managerem.md` (zones, prices, windows, max per window, e-mail wording),
`specs/004-pickup-scheduling/spec.md` note that delivery is now offered.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Own zone table instead of Medusa geo zones | Zone decided by postal code alone, zones crossing the Kraków border, code lists pasted by staff | Native `zip` geo zones also compare the customer's city by equality; one code covers several villages, so the typed city rarely matches (R-01) |
| Custom fulfillment provider (`catering-delivery`) | Price per cart from our zones and from staff-set out-of-zone cost | Flat options per zone cannot carry a per-cart staff price and would split zone data (R-02) |
