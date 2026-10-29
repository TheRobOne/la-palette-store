---

description: "Task list for 007-delivery-zones"
---

# Tasks: City Delivery in Postal-Code Zones

**Input**: Design documents from `/specs/007-delivery-zones/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/store-api.md](contracts/store-api.md),
[contracts/admin-api.md](contracts/admin-api.md), [contracts/emails.md](contracts/emails.md),
[quickstart.md](quickstart.md)

**Tests**: required — constitution Principle VI (delivery zone matching and delivery cost, the
checkout-to-order flow for both methods, delivery-slot validation, on-request flow) and SC-007
(per-window limit under concurrency).

**Organization**: by user story; paths relative to the repo root, backend in `apps/backend/`.
Integration tests run against the dev PostgreSQL (README "Integration tests"); helpers from
`integration-tests/http/pickup-scheduling.spec.ts` and `pickup-requests.spec.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1–US5 from spec.md

---

## Phase 1: Setup

- [X] T001 Verify in Medusa 2.21.1 sources and record in [research.md](research.md) (R-02): (a) a handler on `listShippingOptionsForCartWithPricingWorkflow.hooks.setCalculatedShippingPricingContext` also runs when the workflow runs as a step inside `addShippingMethodToCartWorkflow` and `refreshCartShippingMethodsWorkflow`; (b) the hook input carries `cart_id` and the provider's `calculatePrice` context receives the hook result merged with the cart; (c) registering `@medusajs/medusa/fulfillment` with providers `@medusajs/medusa/fulfillment-manual` (id `manual`) + `./src/modules/catering-delivery` keeps `manual_manual` for pickup; (d) calling `addShippingMethodToCartWorkflow` with the same option on a cart that already has it replaces the method (used to re-price after a staff confirmation)
- [X] T002 Register the fulfillment module in `apps/backend/medusa-config.ts`: `resolve: "@medusajs/medusa/fulfillment"`, providers `[{ resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" }, { resolve: "./src/modules/catering-delivery", id: "catering-delivery" }]` (provider id `catering-delivery_catering-delivery`, research R-11)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 `apps/backend/src/modules/catering/models/fulfillment-schedule.ts`: `FULFILLMENT_METHODS = ["pickup", "delivery"] as const` (update the comment); add `max_orders_per_window: model.number().nullable()` — "≥ 1 when set; null = no per-window limit. Pickup: null. Delivery default (setup): 2."
- [X] T004 [P] New models (amounts as `model.bigNumber()` — `numeric`, exact for prices like 29,99 zł; `number` would be `integer`) `apps/backend/src/modules/catering/models/delivery-zone.ts` (`id` prefix `dzone`, `name` text — "required, unique among non-deleted zones", `price` number — "≥ 0, gross PLN", `min_order_value` number nullable — "≥ 0; null = only the global minimum applies", `codes` hasMany) and `delivery-zone-code.ts` (`id` prefix `dzcode`, `zone` belongsTo with cascade delete, `code` text — "full postal code `^\d{2}-\d{3}$`", unique index on `code` where `deleted_at IS NULL`); register both in `apps/backend/src/modules/catering/service.ts`
- [X] T005 [P] `apps/backend/src/modules/catering/models/booking.ts`: add nullable `delivery_postal_code` ("`XX-XXX`; delivery only"), `delivery_zone_id` ("matched zone at booking time; null = out of zone"), `delivery_zone_name`, `delivery_cost` number ("in zone: price paid; out of zone: set by staff on confirm"); extend `RequestSnapshot` with optional `delivery: { postal_code: string }`
- [X] T006 Generate the migration: `cd apps/backend && pnpm exec medusa db:generate catering` (new file in `src/modules/catering/migrations/`, enum check on `blocked_date`, `booking`, `fulfillment_schedule`, `window_rule`, new tables and columns); review it, run `pnpm exec medusa db:migrate` on the dev DB (research R-12)
- [X] T007 [P] Pure delivery rules in `apps/backend/src/modules/catering/delivery/`: `postal-code.ts` (`isValidPostalCode` — trimmed value matches `^\d{2}-\d{3}$`; `parsePostalCodeList(text)` — split on commas, whitespace and newlines, dedupe, return `{ valid, invalid }`), `quote.ts` (`quoteDelivery({ postalCode, itemTotal, zones, freeThreshold, globalMinimum, confirmedCost })` → `invalid` | `in_zone` (zone, amount — 0 when threshold set and itemTotal ≥ threshold, else zone price; `min_order_value` = max(global, zone minimum ?? 0)) | `out_of_zone` (amount = confirmedCost ?? null, `requires_confirmation: true`)); unit tests in `apps/backend/src/modules/catering/delivery/__tests__/postal-code.unit.spec.ts` and `quote.unit.spec.ts` (valid/invalid formats incl. `31870`, `31-7`, ` 31-870 `; threshold edge equal; zone minimum below/above global)
- [X] T008 [P] Free-delivery threshold setting in `apps/backend/src/lib/min-order-value.ts` (or a sibling `free-delivery-threshold.ts` in the same style): metadata key `catering_free_delivery_threshold`, "> 0; empty/absent = no free delivery (launch)"; unit test next to `src/lib/__tests__/order-rules.unit.spec.ts`
- [X] T009 I/O wrapper `apps/backend/src/lib/delivery.ts`: `loadDeliveryZones(container)` (zones with codes), `loadFreeDeliveryThreshold(container)`, `quoteForPostalCode(container, postalCode, { itemTotal?, cartId? })` (reads the cart's confirmed out-of-zone booking `delivery_cost` when `cartId` given) and `quoteForCart(container, cart)` — all using T007
- [X] T010 Fulfillment provider `apps/backend/src/modules/catering-delivery/service.ts` + `index.ts` (`ModuleProvider(Modules.FULFILLMENT, { services: [...] })`): `identifier = "catering-delivery"`, `getFulfillmentOptions` → `[{ id: "delivery" }]`, `validateOption`/`validateFulfillmentData` accept, `canCalculate` → true, `calculatePrice` → `{ calculated_amount: context.catering_delivery_amount ?? 0, is_calculated_price_tax_inclusive: true }` and never throws (research R-02), `createFulfillment` → `{ data: {}, labels: [] }`; unit test `apps/backend/src/modules/catering-delivery/__tests__/service.unit.spec.ts`
- [X] T011 Pricing hook `apps/backend/src/workflows/hooks/delivery-pricing-context.ts`: `listShippingOptionsForCartWithPricingWorkflow.hooks.setCalculatedShippingPricingContext` — **and** `calculateShippingOptionsPricesWorkflow` (the `POST /store/shipping-options/:id/calculate` route the storefront uses to read a calculated price; found by T014) → load the cart (`shipping_address.postal_code`, `item_total`), `quoteForCart` (T009) → `{ catering_delivery_amount: amount ?? 0 }`; no-op `{}` when the cart has no postal code
- [X] T012 Setup `apps/backend/src/scripts/setup-delivery.ts` (idempotent, by stable names in `apps/backend/src/lib/pickup.ts` — add `DELIVERY_FULFILLMENT_SET_NAME = "Dostawa"`, `DELIVERY_SERVICE_ZONE_NAME = "Polska"`, `DELIVERY_SHIPPING_OPTION_NAME = "Dostawa"`, `DELIVERY_OPTION_TYPE_CODE = "delivery"`): fulfillment set type `shipping` on stock location "Kuchnia La Palette", service zone with country geo zone PL, option `price_type: "calculated"`, provider `catering-delivery_catering-delivery`, same shipping profile and rules as pickup; `delivery` schedule row (lead 48 h, horizon as pickup, `max_orders_per_window: 2`) and windows 10–12, 12–14, 14–16, 16–18 on the pickup weekdays only if no delivery windows exist; example zones from spec Assumptions only if no zone exists (Strefa 1: 31-762, 31-763, 31-764, 32-005, 32-010, 32-020 — 30 zł; Strefa 2: 30-001, 31-001 — 50 zł); call it from `apps/backend/src/scripts/seed.ts` after `setupPickupSchedule`; remove the "non-pickup shipping options" warning and the "only fulfillment" comments in `apps/backend/src/scripts/setup-pickup.ts` and `src/lib/pickup.ts`
- [X] T013 [P] Method-aware term messages in `apps/backend/src/modules/catering/scheduling/term.ts`: `missingTermError(method)`, `unavailableTermError(term)` use "termin odbioru" / "termin dostawy"; update callers and `scheduling/__tests__/term.unit.spec.ts`

**Checkpoint**: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test:unit` green; `pnpm dev` starts, seed creates the delivery option, schedule and zones; pickup integration suites still pass

---

## Phase 3: User Story 1 - Customer orders with delivery to an address in a zone (Priority: P1) 🎯 MVP

**Goal**: an in-zone customer sees the delivery price in the cart, picks a delivery window, pays and gets an order with address, window and delivery cost.

**Independent Test**: quickstart V1–V4, V9.

### Tests for User Story 1

- [X] T014 [US1] Integration tests `apps/backend/integration-tests/http/delivery.spec.ts`: quote for in-zone / out-of-zone / invalid codes (contracts/store-api.md §4); `listCartOptions` lists `type.code: "delivery"` with the zone price after setting `shipping_address`; changing the postal code re-prices `shipping_total`; free-delivery threshold gives 0; a complete delivery order keeps `shipping_address`, `shipping_total`, `catering_term.method: "delivery"` and a booking with `delivery_zone_name` / `delivery_cost`; refusals with the exact Polish messages of §7 (no phone, invalid code, method ≠ option, price changed by staff between cart and completion, below zone minimum); pickup checkout without `shipping_address` still completes

### Implementation for User Story 1

- [X] T015 [P] [US1] Store route `apps/backend/src/api/store/catering/delivery-quote/route.ts` (`GET`, query `postal_code` required, `cart_id` optional; validator in `apps/backend/src/api/validators/catering-delivery.ts`, registered in `apps/backend/src/api/middlewares.ts`) → `{ delivery_quote }` exactly as contracts/store-api.md §4
- [X] T016 [P] [US1] `apps/backend/src/api/store/catering/order-rules/route.ts` + `src/lib/order-rules.ts`: `fulfillment.delivery = { enabled: <delivery schedule is_enabled>, free_delivery_threshold }` (§1); update `src/lib/__tests__/order-rules.unit.spec.ts`
- [X] T017 [US1] `apps/backend/src/lib/cart-order-checks.ts`: add `shipping_address.*`, `shipping_methods.amount`, `shipping_methods.shipping_option_id` to `CART_CHECK_FIELDS` and the type; new `assertFulfillmentRules(container, cart, term)` → resolves the option's `type.code` and refuses a mismatch with `catering_term.method`; for delivery: required `address_1`, `postal_code`, `city`, `phone` (`Uzupełnij adres dostawy: <missing fields>.`), valid code (`Podaj poprawny kod pocztowy (XX-XXX).`), effective minimum (`Minimalna wartość zamówienia z dostawą pod ten adres to …`), and returns the quote; call it from `assertCartOrderRules` after the term check
- [X] T018 [US1] `apps/backend/src/workflows/hooks/complete-cart-validate.ts` + `src/lib/pickup-booking.ts`: for an in-zone delivery cart compare `shipping_methods[0].amount` with the quote (`Koszt dostawy się zmienił — sprawdź koszyk i spróbuj ponownie.`); `reservePickupTerm` stores `delivery_postal_code`, `delivery_zone_id`, `delivery_zone_name`, `delivery_cost` on the created booking; out-of-zone carts without a confirmed request → `Dostawa pod ten adres wymaga potwierdzenia kuchni — wyślij zapytanie.` (full flow in US3)
- [X] T019 [US1] Staff view: `apps/backend/src/api/admin/catering/calendar/route.ts` entries gain `method`, `address`, `phone`, `zone_name`, `delivery_cost` (contracts/admin-api.md "Calendar"); `apps/backend/src/admin/routes/pickups/page.tsx` shows "Odbiór"/"Dostawa" per entry with address, phone, zone; `apps/backend/src/admin/widgets/order-pickup-term.tsx` shows method, address and delivery cost

**Checkpoint**: an in-zone delivery order can be placed end to end; pickup unchanged

---

## Phase 4: User Story 2 - Staff manage zones and prices in the Admin (Priority: P1)

**Goal**: staff create, edit and delete zones with pasted code lists; changes apply to the next cart.

**Independent Test**: quickstart V5; V4 price change.

### Tests for User Story 2

- [X] T020 [US2] Integration tests in `apps/backend/integration-tests/http/delivery.spec.ts` (Admin block): create/update/delete zone; invalid entries → 400 `Nieprawidłowe kody pocztowe: …`; codes taken by another zone → 400 `Kody … są już w strefie „…”.`; duplicate name → 400; `match` returns the zone; a price change applies to a new cart and leaves a placed order's `shipping_total` unchanged

### Implementation for User Story 2

- [X] T021 [US2] Workflows `apps/backend/src/workflows/save-delivery-zone.ts` (create or full replace: validate name, price ≥ 0, minimum ≥ 0 or null, at least one code, every code `XX-XXX`, codes not in another zone — one error naming all offending entries; replace codes of the zone in one step with compensation) and `apps/backend/src/workflows/delete-delivery-zone.ts`
- [X] T022 [US2] Admin routes `apps/backend/src/api/admin/catering/delivery-zones/route.ts` (`GET`, `POST`), `[id]/route.ts` (`POST`, `DELETE`), `match/route.ts` (`GET ?postal_code`) with validators in `apps/backend/src/api/validators/catering-delivery.ts` and middlewares, shapes as contracts/admin-api.md
- [X] T023 [US2] Admin page `apps/backend/src/admin/routes/settings/delivery-zones/page.tsx` ("Strefy dostawy"): list (name, price, minimum, number of codes), create/edit drawer with a textarea for codes (pasted list, split client-side with the same rule), server error shown as is, delete with confirmation, "Sprawdź kod pocztowy" field using `match`; API calls through `apps/backend/src/admin/lib/catering-api.ts`
- [X] T024 [P] [US2] `apps/backend/src/admin/widgets/min-order-value.tsx`: add "Darmowa dostawa od (zł)" (empty = off) writing `catering_free_delivery_threshold` to store metadata

**Checkpoint**: US1 + US2 = the shop can take delivery orders with staff-managed zones (MVP)

---

## Phase 5: User Story 3 - Address outside every zone goes to the kitchen (Priority: P2)

**Goal**: out-of-zone customers send a request; staff confirm with a delivery cost; the customer pays the re-priced cart.

**Independent Test**: quickstart V6.

### Tests for User Story 3

- [X] T025 [US3] Integration tests in `apps/backend/integration-tests/http/delivery.spec.ts`: out-of-zone cart on a standard window → `POST /store/catering/requests` accepted; completing it before confirmation → 400; confirm without `delivery_cost` → 400 `Podaj koszt dostawy.`; confirm an in-zone request with `delivery_cost` → 400; confirm with 80 → status shows `fulfillment.delivery_cost: 80`, cart `shipping_total` 80, completion creates an order with 80; postal code changed after sending → payment refused (snapshot); expiry releases capacity as in 005

### Implementation for User Story 3

- [X] T026 [US3] Needs-confirmation rule: in `apps/backend/src/lib/pickup-booking.ts` and `apps/backend/src/workflows/send-pickup-request.ts` a delivery cart whose quote is `out_of_zone` is treated as on request for any window (send: no `notOnRequestError`; reserve: requires a confirmed, unexpired request); `buildSnapshot` / `snapshotMatches` in `apps/backend/src/modules/catering/scheduling/requests.ts` include `delivery.postal_code` (unit test in `scheduling/__tests__/requests.unit.spec.ts`)
- [X] T027 [US3] `apps/backend/src/workflows/decide-pickup-request.ts` + `apps/backend/src/api/admin/catering/requests/[id]/confirm/route.ts` (validator `{ delivery_cost?: number ≥ 0 }`): out-of-zone delivery request requires `delivery_cost`, any other refuses it; store it on the booking; after confirming, re-run `addShippingMethodToCartWorkflow` with the delivery option on the request's cart so the hook re-prices it (T001 d) — use `refreshCartShippingMethodsWorkflow({ cart_id })` instead (research R-13 d)
- [X] T028 [P] [US3] Request DTOs `apps/backend/src/lib/request-dto.ts` / `src/lib/admin-requests.ts`: `fulfillment: { method, address, phone, postal_code, zone_name, out_of_zone, delivery_cost }` for `GET /store/catering/requests/:cart_id` and the Admin list (contracts store-api §6, admin-api "Requests")
- [X] T029 [US3] `apps/backend/src/admin/routes/pickup-requests/page.tsx`: show method, address, zone or "poza strefą"; confirm dialog asks for "Koszt dostawy (zł)" (required) for out-of-zone requests

---

## Phase 6: User Story 4 - Delivery has its own schedule (Priority: P2)

**Goal**: separate delivery windows, lead time, blocks and a per-window delivery maximum; shared daily capacity.

**Independent Test**: quickstart V7.

### Tests for User Story 4

- [X] T030 [P] [US4] Unit tests `apps/backend/src/modules/catering/scheduling/__tests__/availability.unit.spec.ts`: window `available: false, reason: "window_full"` at the maximum; other windows of the day unaffected; null maximum = no limit; day-level `full` unchanged; `checkTerm` reports `window_full`
- [X] T031 [US4] Integration tests in `apps/backend/integration-tests/http/delivery.spec.ts`: two delivery orders fill a window with max 2 → slots show `window_full`, pickup still offered; two parallel completions for the last window place → exactly one succeeds (SC-007); requests (`requested`/`confirmed`) count; a date blocked for delivery only leaves pickup open; `GET|POST /admin/catering/schedule?method=delivery` with `max_orders_per_window`, non-null for pickup → 400

### Implementation for User Story 4

- [X] T032 [US4] `apps/backend/src/modules/catering/scheduling/availability.ts` + `load.ts`: `ScheduleInputs` gains `maxOrdersPerWindow` and `bookingsPerWindow` (key `date|start|end`, same method, `CAPACITY_STATUSES`, respecting `excludeBookingIds`); window `reason` (`null` | `full` | `window_full` | `lead_time`); `checkTerm` adds `window_full`; `UnavailableReason` and `apps/backend/src/lib/schedule-dto.ts` updated
- [X] T033 [US4] Schedule API `apps/backend/src/api/admin/catering/schedule/route.ts`, validator in `apps/backend/src/api/validators/catering-scheduling.ts`, `apps/backend/src/workflows/update-pickup-schedule.ts`: read/write `max_orders_per_window` (≥ 1 or null; refused for pickup)
- [X] T034 [US4] `apps/backend/src/admin/routes/settings/pickup-schedule/page.tsx`: method switch "Odbiór / Dostawa" (drop the hard-coded `method=pickup`), "Maks. dostaw w jednym oknie" field for delivery, block scope options "Tylko odbiory" / "Tylko dostawy" / "Wszystko"
- [X] T035 [US4] Reschedule (004 FR-015) for delivery: `apps/backend/src/workflows/reschedule-order-pickup.ts` and `apps/backend/src/api/admin/catering/orders/[id]/pickup-term/route.ts` / `requests/[id]/pickup-term/route.ts` use the booking's method and report the confirmable `window_full` warning; Admin dialog in `order-pickup-term.tsx` lists delivery windows for delivery orders

---

## Phase 7: User Story 5 - E-mails and the Admin speak about delivery (Priority: P2)

**Goal**: every e-mail of a delivery order/request shows address, window and cost instead of pickup info.

**Independent Test**: quickstart V8.

### Tests for User Story 5

- [X] T036 [P] [US5] Unit tests `apps/backend/src/lib/emails/__tests__/templates.unit.spec.ts`: for each template in contracts/emails.md the delivery variant has the delivery subject, address, window and cost line, no venue address/map link; pickup variants unchanged (existing assertions stay)
- [X] T037 [US5] Integration test in `apps/backend/integration-tests/http/notifications.spec.ts`: a delivery order produces `order-confirmation` and `staff-new-order` whose data carry `fulfillment.method: "delivery"`, address and cost

### Implementation for User Story 5

- [X] T038 [US5] `apps/backend/src/lib/emails/data.ts` + `types.ts`: replace `pickup_address` with `fulfillment: { method: "pickup", address } | { method: "delivery", address, phone, zone_name, delivery_cost }` from the order's `shipping_address`/booking (requests: from the cart and booking); keep old stored notification data renderable (retry job) by treating a missing `fulfillment` as pickup
- [X] T039 [US5] Templates `apps/backend/src/lib/emails/templates/order.ts`, `request.ts`, `pickup.ts` (+ staff templates): subjects and wording by method per contracts/emails.md; delivery cost line before the total; reminder "Jutro dostawa…" with "kierowca zadzwoni pod numer {phone}"; template ids unchanged (research R-10)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T040 [P] `apps/backend/AGENTS.md`: replace "Fulfillment — in-person pickup only" with pickup + delivery (option `type.code`, `shipping_address` for delivery only, quote route, calculated option, pricing hook, setup names), extend "Cart completion errors" with the §7 messages, link specs/007 contracts
- [X] T041 [P] `specs/004-pickup-scheduling/spec.md`: one-line note under FR-011 that delivery is offered since 007 (constitution 2.4.x)
- [X] T042 [P] `docs/do-omowienia-z-managerem.md` section 4: quote the exact customer-facing texts as implemented (out-of-zone message, §7 errors, e-mail subjects) with their file paths; keep the defaults table in sync with `setup-delivery.ts`
- [ ] T043 Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run test:unit`, then `pnpm run test:integration` against the dev DB; walk through quickstart V1–V9 on `pnpm dev`; note results in the PR description (constitution VI)

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T013)** → user stories.
- **US1 (T014–T019)** needs Foundational. **US2 (T020–T024)** needs Foundational; independent of US1 except that its price-change test uses the US1 checkout. US1 + US2 = MVP.
- **US3 (T025–T029)** needs US1 (delivery checks in completion) and the 005 request flow.
- **US4 (T030–T035)** needs Foundational only (delivery schedule rows from T012); can run in parallel with US1–US3.
- **US5 (T036–T039)** needs US1 (delivery orders) and, for request e-mails, US3.
- **Polish (T040–T043)** last.

Within Foundational: T003–T005 → T006 (migration) → T009, T011, T012; T007, T008, T010, T013 in parallel with the models.

## Parallel Examples

- Foundational: T004, T005, T007, T008, T013 together; then T010 while T009 is written.
- US1: T015 and T016 in parallel while T017 is in progress.
- US2: T024 alongside T021–T023.
- US4: T030 (unit tests) alongside T033–T034.
- US5: T036 alongside T038.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 + US2 — delivery orders in staff-managed zones; stop and validate quickstart V1–V5, V9.
2. **US4** next (the driver limit matters as soon as real orders come in), then **US3** (out-of-zone requests), then **US5** (e-mails). Deploy to staging after each story.
3. Real zone lists and prices are Admin data entered after the manager's decision (docs/do-omowienia-z-managerem.md §4) — no code change.
