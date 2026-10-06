---

description: "Task list for 004-pickup-scheduling"
---

# Tasks: Pickup Scheduling

**Input**: Design documents from `/specs/004-pickup-scheduling/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/store-api.md](contracts/store-api.md),
[contracts/admin-api.md](contracts/admin-api.md), [quickstart.md](quickstart.md)

**Tests**: required — SC-001 demands automated tests incl. a concurrent "last place" scenario;
constitution Principle VI.

**Organization**: tasks are grouped by user story. All paths are relative to the repo root;
backend code lives in `apps/backend/`. Commands run from `apps/backend` with pnpm.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1–US5 from spec.md

---

## Phase 1: Setup

**Purpose**: confirm the platform pieces the design relies on

- [ ] T001 Confirm Medusa's locking module is registered by default with the in-memory provider (no entry needed in `apps/backend/medusa-config.ts` for dev/staging; production Redis locking is the constitution's existing requirement) by resolving `Modules.LOCKING` in a scratch `medusa exec` script or an integration test container; record the result in [research.md](research.md) R-03

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: models, migration, pure scheduling functions and the default schedule — every story depends on them

- [ ] T002 [P] Create model `SchedulingSettings` in `apps/backend/src/modules/catering/models/scheduling-settings.ts`: id prefix `schset`; `daily_capacity` number, "≥ 0; 0 = no orders accepted; default 10"
- [ ] T003 [P] Create model `FulfillmentSchedule` in `apps/backend/src/modules/catering/models/fulfillment-schedule.ts`: id prefix `fsched`; `fulfillment_method` enum `["pickup"]` unique; `is_enabled` boolean default true; `lead_time_hours` number "≥ 0; default 48; measured to the window start"; `booking_horizon_days` number "1–365; default 60"; export the `FULFILLMENT_METHODS = ["pickup"] as const` tuple from this file for reuse
- [ ] T004 [P] Create model `WindowRule` in `apps/backend/src/modules/catering/models/window-rule.ts`: id prefix `wrule`; `fulfillment_method` enum; `weekday` number "ISO 1 = Monday … 7 = Sunday"; `start_time`/`end_time` text `HH:mm` with `start_time` < `end_time`
- [ ] T005 [P] Create model `BlockedDate` in `apps/backend/src/modules/catering/models/blocked-date.ts`: id prefix `blkd`; `date` text `YYYY-MM-DD`; `fulfillment_method` enum nullable ("`null` = blocks every method"); `reason` text nullable; unique index on (`date`, `fulfillment_method`)
- [ ] T006 [P] Create model `Booking` in `apps/backend/src/modules/catering/models/booking.ts`: id prefix `bkg`; `cart_id` text; `order_id` text nullable; `fulfillment_method` enum; `date` text `YYYY-MM-DD` indexed; `start_time`/`end_time` text `HH:mm`; `status` enum `["active","canceled"]` default `active`; `previous_date`, `previous_start_time`, `previous_end_time` text nullable; `rescheduled_at` dateTime nullable; index on `cart_id`
- [ ] T007 Register the five models in `MedusaService({...})` in `apps/backend/src/modules/catering/service.ts` (keep the existing `CateringProductInfo` overrides unchanged)
- [ ] T008 Generate the migration with `pnpm exec medusa db:generate catering` into `apps/backend/src/modules/catering/migrations/` and review it (no changes to `catering_product_info`)
- [ ] T009 [P] Implement Warsaw time helpers in `apps/backend/src/modules/catering/scheduling/time.ts` per research R-05 (`Intl.DateTimeFormat` with `timeZone: "Europe/Warsaw"`, no new dependency): `warsawToday(now)`, `isoWeekday(date)`, `warsawWallClockToInstant(date, "HH:mm")` (offset computed then corrected once), `addDays(date, n)`, `formatPlDate(date)` → `20.10.2026`
- [ ] T010 [P] Unit tests in `apps/backend/src/modules/catering/scheduling/__tests__/time.unit.spec.ts`: winter (+01:00) and summer (+02:00) offsets, 2026-03-29 and 2026-10-25 transitions (10:00 maps to 08:00Z/09:00Z correctly on both sides), `warsawToday` near midnight UTC, ISO weekday for a known Monday and Sunday
- [ ] T011 Implement pure `computeAvailability({ now, from, to, method, schedule, windows, blockedDates, bookingsPerDate, dailyCapacity })` in `apps/backend/src/modules/catering/scheduling/availability.ts` returning the `days[]` shape of [contracts/store-api.md](contracts/store-api.md) §1 and following the five rules and reason order of [data-model.md](data-model.md) "Derived: availability" (`past`, `beyond_horizon`, `disabled`, `blocked`, `closed`, `full`, `lead_time`); also export `checkTerm(term, sameInputs)` → `{ ok: true } | { ok: false, reasons: string[] }` for a single date/window (used by the completion hook and reschedule warnings; a window must exactly match a rule of that weekday)
- [ ] T012 [P] Unit tests in `apps/backend/src/modules/catering/scheduling/__tests__/availability.unit.spec.ts`: Monday closed with default rules; lead time measured to window start (10:00 window two days ahead available at 09:59, not at 10:00); blocked date with method `null` and with `pickup`; `full` when bookings = capacity keeps windows listed as unavailable; capacity 0; horizon boundary (today + horizon offered, +1 not); `from` in the past clamped; disabled schedule; Sunday 2026-10-25 lists the same 8 windows as other Sundays; `checkTerm` rejects a window not matching any rule
- [ ] T013 [P] Implement term parsing in `apps/backend/src/modules/catering/scheduling/term.ts`: key `CATERING_TERM_METADATA_KEY = "catering_term"`; `parseTerm(metadata)` validating `{ method: "pickup", date: YYYY-MM-DD (real calendar date), start/end: HH:mm }` → term or `null`; Polish messages exactly as in [contracts/store-api.md](contracts/store-api.md) §3 (`Wybierz termin odbioru.`, `Wybrany termin odbioru (20.10.2026, 11:00–12:00) nie jest już dostępny. Wybierz inny termin.`, `Nie udało się zarezerwować terminu. Spróbuj ponownie za chwilę.`)
- [ ] T014 [P] Unit tests in `apps/backend/src/modules/catering/scheduling/__tests__/term.unit.spec.ts`: valid term, missing key, wrong method, `2026-02-30`, `24:00`, start ≥ end, message formatting with Polish date and en dash
- [ ] T015 Implement `loadSchedulingContext(container, method, from, to)` in `apps/backend/src/modules/catering/scheduling/load.ts`: reads settings, schedule, window rules, blocked dates in range and counts of `active` bookings per date (all methods) with at most 4 queries; returns the inputs of `computeAvailability`
- [ ] T016 Create idempotent `setupPickupSchedule(container)` in `apps/backend/src/scripts/setup-pickup-schedule.ts` (default export runs it via `medusa exec`): creates `SchedulingSettings` (capacity 10) and the `pickup` `FulfillmentSchedule` (48 h, 60 days) if missing, and window rules Tuesday–Sunday hourly 10:00–18:00 only when the method has no rules; never overwrites staff changes
- [ ] T017 Call `setupPickupSchedule(container)` from `apps/backend/src/scripts/seed.ts` right after `setupPickup(container)`

**Checkpoint**: `pnpm run test:unit` green; migration applies on the dev DB; seed creates the default schedule once

---

## Phase 3: User Story 1 - Customer orders for a pickup date and time slot (Priority: P1) 🎯 MVP

**Goal**: customers see only valid terms and an order cannot be placed without a valid term

**Independent Test**: with the default schedule, `GET /store/catering/slots` hides Mondays and terms inside 48 h; completing a cart without a term or with a blocked/past-lead-time term is rejected; a valid term ends up in `order.metadata.catering_term`

### Tests for User Story 1

- [ ] T018 [US1] Integration tests in `apps/backend/integration-tests/http/pickup-scheduling.spec.ts` (reuse the seed/cart/payment helpers pattern of `pickup-order-rules.spec.ts`; carts must satisfy the 100 zł minimum): slots for 14 days list every date with Mondays `closed` and the first 48 h `lead_time`; range > 62 days → 400; complete without `catering_term` → 400 `Wybierz termin odbioru.`; term on a date blocked via the module service → 400 "nie jest już dostępny"; valid term → `type: "order"` and order metadata (via `query.graph`) equals the cart's `catering_term`
- [ ] T019 [US1] Update `apps/backend/integration-tests/http/pickup-order-rules.spec.ts` so its successful-order and invoice tests set a valid `catering_term` (first available window from `/store/catering/slots`) before completing

### Implementation for User Story 1

- [ ] T020 [P] [US1] Store route `apps/backend/src/api/store/catering/slots/route.ts`: `GET` with `from`, `to`, `method` per [contracts/store-api.md](contracts/store-api.md) §1 (clamp `from` to today, max 62 days, `400 invalid_data` otherwise), using `loadSchedulingContext` + `computeAvailability`; response `{ slots: { method, timezone: "Europe/Warsaw", from, to, days } }`; never return blocked-date reasons
- [ ] T021 [P] [US1] Register a zod query validator for `GET /store/catering/slots` in `apps/backend/src/api/middlewares.ts` (`validateAndTransformQuery`) — keep the existing `noIndexHeader` and search middlewares
- [ ] T022 [US1] Extend the single handler in `apps/backend/src/workflows/hooks/complete-cart-validate.ts`: after the minimum-order and invoice checks, `parseTerm(cart.metadata)` → `Wybierz termin odbioru.` when missing; `checkTerm` with `loadSchedulingContext` → "nie jest już dostępny" message when any rule fails (capacity counted from existing bookings; no booking is created yet in this story)

**Checkpoint**: US1 independently testable — T018/T019 pass

---

## Phase 4: User Story 2 - The kitchen is never overbooked (Priority: P1)

**Goal**: completion takes a place atomically; full days disappear; cancellations free places

**Independent Test**: capacity 1 → two concurrent completions produce exactly one order; the day is then `full`; cancelling the order makes it available again

### Tests for User Story 2

- [ ] T023 [US2] Add to `apps/backend/integration-tests/http/pickup-scheduling.spec.ts`: set `daily_capacity` to 1 via the module service; complete two prepared carts for the same day with `Promise.all` → exactly one `type: "order"` and one 400 "nie jest już dostępny"; slots show that day `full`; cancel the order (`POST /admin/orders/:id/cancel` with an admin token, or `cancelOrderWorkflow`) → day available again and the booking `canceled`; retrying `complete` on an already completed cart returns the same order and still one booking (idempotency, R-03)
- [ ] T023a [P] [US2] Unit test in `apps/backend/src/workflows/hooks/__tests__/complete-cart-validate.unit.spec.ts` for the compensation function exported from the hook file (export it as a named function): with a booking id it calls the catering service's `deleteBookings` with that id; with `undefined` it does nothing (a later-step failure cannot be forced reliably through the Store API with the system payment provider)

### Implementation for User Story 2

- [ ] T024 [US2] In `apps/backend/src/workflows/hooks/complete-cart-validate.ts` wrap the term check in `lockingModule.execute("catering:capacity:<date>", job, { timeout: 5 })` (resolve `Modules.LOCKING`); inside the lock: if an `active` booking exists for `cart.id` with the same term → accept without counting it (idempotent retry, research R-03); otherwise count `active` bookings for the date, run `checkTerm`, create a `Booking` (`cart_id`, method, date, start, end, `active`); return `new StepResponse(undefined, createdBookingId)`; lock timeout → `Nie udało się zarezerwować terminu. Spróbuj ponownie za chwilę.`
- [ ] T025 [US2] Add the compensation function as the second argument of `completeCartWorkflow.hooks.validate(...)` in the same file: delete the booking whose id was returned (no-op when `undefined`)
- [ ] T026 [P] [US2] Subscriber `apps/backend/src/subscribers/pickup-booking-order-placed.ts` on `order.placed`: resolve the order's cart through the `order_cart` link (`query.graph({ entity: "order_cart", fields: ["cart_id"], filters: { order_id } })`) and set `order_id` on the cart's active booking
- [ ] T027 [P] [US2] Subscriber `apps/backend/src/subscribers/pickup-booking-order-canceled.ts` on `order.canceled`: set `status: "canceled"` on the booking with that `order_id` (fall back to the `order_cart` link when `order_id` is not set yet)

**Checkpoint**: US1 + US2 pass; capacity can never be exceeded through the Store API

---

## Phase 5: User Story 3 - Staff manage the schedule, blocked days and limits (Priority: P1)

**Goal**: staff change windows, lead time, horizon, capacity and blocked dates in the Admin without a deploy

**Independent Test**: via the Admin API/UI block a date, change Saturday windows and capacity; `/store/catering/slots` reflects it immediately

### Tests for User Story 3

- [ ] T028 [US3] Add Admin API tests to `apps/backend/integration-tests/http/pickup-scheduling.spec.ts` (create an admin user + token as in `admin-seed.spec.ts`): `GET/POST /admin/catering/schedule` round-trip; overlapping windows → 400; `POST /admin/catering/blocked-dates` on a date with one booking returns `existing_orders: 1` and the date disappears from Store slots; `DELETE` restores it

### Implementation for User Story 3

- [ ] T029 [P] [US3] Workflow `apps/backend/src/workflows/update-pickup-schedule.ts`: input per [contracts/admin-api.md](contracts/admin-api.md) Schedule; validates "windows of the same method and weekday MUST NOT overlap; duplicates rejected", `lead_time_hours` ≥ 0, `booking_horizon_days` 1–365, `daily_capacity` ≥ 0; replaces the method's window rules as a whole and updates schedule + settings (steps with compensation restoring previous values)
- [ ] T030 [P] [US3] Workflows `apps/backend/src/workflows/block-date.ts` and `apps/backend/src/workflows/unblock-date.ts`: create/delete `BlockedDate`; block returns the count of `active` bookings on the date; reject a duplicate (date, method)
- [ ] T031 [US3] Admin routes `apps/backend/src/api/admin/catering/schedule/route.ts` (`GET`, `POST`), `apps/backend/src/api/admin/catering/blocked-dates/route.ts` (`GET ?from&to`, `POST`) and `apps/backend/src/api/admin/catering/blocked-dates/[id]/route.ts` (`DELETE`) per [contracts/admin-api.md](contracts/admin-api.md); zod body/query validators registered in `apps/backend/src/api/middlewares.ts`
- [ ] T032 [US3] Admin settings page `apps/backend/src/admin/routes/settings/pickup-schedule/page.tsx` (`defineRouteConfig({ label: "Harmonogram odbiorów" })`, `@medusajs/ui`, `@tanstack/react-query` + `fetch` with `credentials: "include"` like `src/admin/widgets/min-order-value.tsx`): weekly windows editor per weekday (add/remove `HH:mm` ranges), lead time (h), horizon (days), daily capacity, enabled toggle; blocked-dates list with add (date, reason, scope "tylko odbiór"/"wszystko") showing the `existing_orders` warning, and remove; Polish labels; toast on save/errors

**Checkpoint**: US3 passes; staff can run the shop's schedule alone

---

## Phase 6: User Story 4 - Staff see pickups in a calendar (Priority: P2)

**Goal**: one view of upcoming pickups by day and window with capacity usage; term visible on each order

**Independent Test**: with orders on several days, `GET /admin/catering/calendar` and the "Odbiory" page group them by window with used/total and blocked markers; the order page shows its term

### Tests for User Story 4

- [ ] T033 [US4] Add to `apps/backend/integration-tests/http/pickup-scheduling.spec.ts`: two orders on one day in different windows + a blocked day → calendar returns `used: 2`, orders grouped by `start`/`end` with `display_id`, blocked day with its reason; range > 62 days → 400

### Implementation for User Story 4

- [ ] T034 [US4] Admin route `apps/backend/src/api/admin/catering/calendar/route.ts` (`GET ?from&to`, max 62 days) per [contracts/admin-api.md](contracts/admin-api.md) Calendar: active bookings in range + blocked dates + `daily_capacity`; order summaries (`display_id`, `email`, `status`) in one `query.graph` on `order` by ids; windows of bookings outside current rules still listed; validator in `apps/backend/src/api/middlewares.ts`
- [ ] T035 [US4] Admin page `apps/backend/src/admin/routes/pickups/page.tsx` with `defineRouteConfig({ label: "Odbiory", icon: <CalendarSolid /> })` (icon from `@medusajs/icons`, already a transitive dependency of the admin — verify import resolves, otherwise omit the icon): list of the next 14 days (prev/next navigation), per day used/total badge, blocked marker with reason, windows with order links to `/orders/:id`, quick "Zablokuj dzień"/"Odblokuj" actions calling the blocked-dates routes
- [ ] T036 [P] [US4] Order widget `apps/backend/src/admin/widgets/order-pickup-term.tsx` (zone `order.details.side.before`): shows "Termin odbioru" from `order.metadata.catering_term` (date `DD.MM.YYYY`, `HH:mm–HH:mm`) and, when present on the booking, the previous term and `rescheduled_at`; fetch booking data through a small `GET` on `apps/backend/src/api/admin/catering/orders/[id]/pickup-term/route.ts` (`{ booking }` or 404)

**Checkpoint**: US4 passes

---

## Phase 7: User Story 5 - Staff reschedule an order (Priority: P3)

**Goal**: staff move an order's term; rule breaks warn but can be confirmed; history kept

**Independent Test**: reschedule to a free term → 200; to a full day → 409 with `warnings: ["full"]`, then with `confirm: true` → 200; order metadata, booking and calendar show the new term and the previous one

### Tests for User Story 5

- [ ] T037 [US5] Add to `apps/backend/integration-tests/http/pickup-scheduling.spec.ts`: reschedule to an available term → 200, `order.metadata.catering_term` updated, booking `previous_*` and `rescheduled_at` set, capacity moved between days; to a full/blocked day without `confirm` → 409 with the matching `warnings`; with `confirm: true` → 200; order without booking → 404

### Implementation for User Story 5

- [ ] T038 [US5] Workflow `apps/backend/src/workflows/reschedule-order-pickup.ts`: input `{ order_id, date, start, end, confirm }`; under the same `catering:capacity:<date>` lock compute `checkTerm` for the new term (counting bookings excluding this order's); if reasons and not `confirm` → throw a conflict carrying `warnings`; else update the booking (copy current term into `previous_*`, set `rescheduled_at`) and `order.metadata.catering_term` (order module update, shallow-merged metadata) with compensation restoring both
- [ ] T039 [US5] Add `POST` to `apps/backend/src/api/admin/catering/orders/[id]/pickup-term/route.ts` per [contracts/admin-api.md](contracts/admin-api.md) Reschedule (409 body `{ type: "conflict", message, warnings }`); body validator in `apps/backend/src/api/middlewares.ts`
- [ ] T040 [US5] Extend `apps/backend/src/admin/widgets/order-pickup-term.tsx` with "Zmień termin": date input + window select filled from `GET /store/catering/slots`-equivalent data (call `/admin/catering/calendar` for the chosen day and the schedule windows), on 409 show the Polish warning list ("dzień pełny", "dzień zablokowany", "poza godzinami", "za krótki czas wyprzedzenia", "poza zakresem rezerwacji", "termin w przeszłości") with a "Zmień mimo to" button that re-sends with `confirm: true`

**Checkpoint**: all stories pass

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T041 [P] Update "Kontrakty dla storefrontu" in `apps/backend/AGENTS.md`: link [contracts/store-api.md](contracts/store-api.md), the `catering_term` metadata key, the completion order (minimum → invoice → term) and that cart metadata is shallow-merged (relax the invoice note "send the whole metadata object" accordingly)
- [ ] T042 [P] Update the module README or `apps/backend/AGENTS.md` with the single-handler rule for `completeCartWorkflow.hooks.validate` now covering three rules, and the lock key convention `catering:capacity:<date>`
- [ ] T043 Run `pnpm run lint`, `pnpm run typecheck`, `npx tsc --noEmit -p src/admin/tsconfig.json` and `pnpm run test:unit` in `apps/backend`
- [ ] T044 Run `pnpm run test:integration:http -- integration-tests/http/pickup-scheduling.spec.ts integration-tests/http/pickup-order-rules.spec.ts integration-tests/http/seed.spec.ts` and note the result in the change description (constitution VI)
- [ ] T045 Manual Admin check per [quickstart.md](quickstart.md) "Manual check" steps 1–4 on the dev DB (apply the migration and seed first)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → **Foundational (T002–T017)** → user stories
- **US1 (T018–T022)** needs Foundational
- **US2 (T023–T027)** needs US1's hook changes (T022) — it adds locking and booking creation to the same handler
- **US3 (T028–T032)** needs Foundational only — can run in parallel with US1/US2 (different files, except `middlewares.ts`: coordinate edits)
- **US4 (T033–T036)** needs US2 (bookings exist and link to orders)
- **US5 (T037–T040)** needs US4 (shares the order widget and `orders/[id]/pickup-term` route)
- **Polish (T041–T045)** after the stories you ship

### Within Each Story

- Tests are written first and fail before the implementation tasks
- Models → pure functions → routes/hooks → Admin UI

### Parallel Opportunities

- T002–T006 (five model files) in parallel; T009/T010, T013/T014 in parallel with them
- T012 in parallel with T013–T016 once T011 exists
- US1 T020 ∥ T021; US2 T026 ∥ T027; US3 T029 ∥ T030; US4 T036 ∥ T034
- US3 as a whole ∥ US1 → US2 (one developer: alternate while integration tests run)

---

## Parallel Example: Foundational

```bash
Task: "T002 SchedulingSettings model in apps/backend/src/modules/catering/models/scheduling-settings.ts"
Task: "T003 FulfillmentSchedule model in apps/backend/src/modules/catering/models/fulfillment-schedule.ts"
Task: "T004 WindowRule model in apps/backend/src/modules/catering/models/window-rule.ts"
Task: "T005 BlockedDate model in apps/backend/src/modules/catering/models/blocked-date.ts"
Task: "T006 Booking model in apps/backend/src/modules/catering/models/booking.ts"
Task: "T009 Warsaw time helpers in apps/backend/src/modules/catering/scheduling/time.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T026 order.placed subscriber in apps/backend/src/subscribers/pickup-booking-order-placed.ts"
Task: "T027 order.canceled subscriber in apps/backend/src/subscribers/pickup-booking-order-canceled.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1–2 (foundation, default schedule from seed)
2. US1 + US2 together — US1 alone would let a full day be overbooked, so ship both before
   la-palette-garden goes live with the term picker (the storefront can start against the
   contract as soon as US1 is merged)
3. Validate with T018/T023, then deploy to staging

### Incremental Delivery

1. Foundation → US1 → US2 → **deploy** (customers can order with terms; staff change schedule
   through seed defaults only)
2. US3 → deploy (staff self-service)
3. US4 → deploy (calendar)
4. US5 → deploy (rescheduling)

---

## Notes

- Every completion rule lives in the one `validate` handler — never add a second handler file
- Commit after each task or logical group; keep the contract in sync if a response shape changes
  and tell the la-palette-garden session
