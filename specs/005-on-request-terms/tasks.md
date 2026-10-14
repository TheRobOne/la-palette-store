---

description: "Task list for 005-on-request-terms"
---

# Tasks: On-Request Pickup Terms

**Input**: Design documents from `/specs/005-on-request-terms/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/store-api.md](contracts/store-api.md),
[contracts/admin-api.md](contracts/admin-api.md), [quickstart.md](quickstart.md)

**Tests**: required — constitution 2.3.0 Principle VI (request, confirmation, decline, both
expiries with capacity release) and SC-001.

**Organization**: by user story; paths relative to the repo root, backend in `apps/backend/`.
Builds on 004 (`specs/004-pickup-scheduling`): booking, `withCapacityLock`,
`loadSchedulingContext`, `checkTerm`, the single `complete-cart-validate.ts` hook.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1–US5 from spec.md

---

## Phase 1: Setup

- [ ] T001 Verify in Medusa 2.21.1 sources (and record in [research.md](research.md)): (a) `src/jobs/*.ts` with `export const config = { name, schedule }` is loaded by `medusa develop/start` in `MEDUSA_WORKER_MODE=shared`; (b) `query.graph({ entity: "cart", fields: ["item_total", "metadata", "billing_address.*", "items.*", "shipping_methods.*", "email"] })` returns computed `item_total` outside a workflow (same fields as `completeCartFields`)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T002 [P] Add `requires_confirmation: model.boolean().default(false)` to `apps/backend/src/modules/catering/models/window-rule.ts` ("`true` = the window is 'on request'")
- [ ] T003 [P] Add to `apps/backend/src/modules/catering/models/fulfillment-schedule.ts`: `request_lead_time_hours` number "≥ 0; default 72", `request_response_hours` number "1–168; default 24", `request_payment_hours` number "1–168; default 24"
- [ ] T004 [P] Extend `apps/backend/src/modules/catering/models/booking.ts`: `BOOKING_STATUSES = ["requested","confirmed","active","declined","expired","canceled"]` (default stays `active`); add `requires_confirmation` boolean default false, `response_deadline` dateTime nullable, `payment_deadline` dateTime nullable, `decided_at` dateTime nullable, `decided_by` text nullable, `request_snapshot` json nullable (`{ items: [{ variant_id, quantity }], term }`)
- [ ] T005 Generate and review the migration `pnpm exec medusa db:generate catering` in `apps/backend/src/modules/catering/migrations/` — the status check constraint must accept the new values; existing rows keep `active`/`canceled`
- [ ] T006 Export `CAPACITY_STATUSES = ["requested","confirmed","active"]` from `apps/backend/src/modules/catering/models/booking.ts` and use it instead of `status: "active"` for capacity counting in `apps/backend/src/modules/catering/scheduling/load.ts`, `apps/backend/src/lib/pickup-booking.ts` (existing-booking lookup), `apps/backend/src/workflows/block-date.ts` (existing_orders) and `apps/backend/src/api/admin/catering/calendar/route.ts`
- [ ] T007 Extend `apps/backend/src/modules/catering/scheduling/availability.ts`: `ScheduleInputs.windows[]` gains `requires_confirmation`, `schedule` gains `request_lead_time_hours`; each returned window gains `requires_confirmation`; rule 4 uses `request_lead_time_hours` for on-request windows and `lead_time_hours` otherwise (also in `checkTerm`, which additionally returns the matched window's `requires_confirmation`); update `apps/backend/src/modules/catering/scheduling/load.ts` to load the new fields
- [ ] T008 [P] Unit tests in `apps/backend/src/modules/catering/scheduling/__tests__/availability.unit.spec.ts` (extend): Monday on-request windows listed with `requires_confirmation: true`; request lead time 72 h vs standard 48 h on the same day; mixed day (10–14 standard, 14–18 on request); capacity counts requested/confirmed (via `bookingsPerDate`)
- [ ] T009 Pure request logic in `apps/backend/src/modules/catering/scheduling/requests.ts`: `responseDeadline(now, hours, windowStart)` and `paymentDeadline(now, hours, windowStart)` = min(now + hours, window start); `canConfirm/canDecline/canPay(booking, now)` per the [data-model.md](data-model.md) state machine; `selectExpired(bookings, now)` → `{ expire: ids of requested past response_deadline, cancel: ids of confirmed past payment_deadline }`; `buildSnapshot(cart, term)` / `snapshotMatches(snapshot, cart, term)` (variant_id+quantity multiset and term; order-insensitive); Polish error factories with the exact texts of [contracts/store-api.md](contracts/store-api.md) §2 and §4
- [ ] T010 [P] Unit tests in `apps/backend/src/modules/catering/scheduling/__tests__/requests.unit.spec.ts`: deadline capping at window start (incl. DST day 2026-10-25), every allowed/forbidden transition, `selectExpired` boundaries (exactly at deadline = not yet expired), snapshot match ignoring item order, mismatch on quantity/extra item/term change
- [ ] T011 Extract shared cart checks into `apps/backend/src/lib/cart-order-checks.ts`: `loadCartForChecks(container, cartId)` (query.graph fields from T001) and `assertCartOrderRules(container, cart)` running minimum order value + invoice data + `parseTerm` (missing → `Wybierz termin odbioru.`), returning the term; refactor `apps/backend/src/workflows/hooks/complete-cart-validate.ts` to use it without behaviour change

**Checkpoint**: `pnpm run test:unit` green, 004 integration tests unchanged

---

## Phase 3: User Story 1 - Customer sends a request (Priority: P1) 🎯 MVP

**Goal**: an on-request window can only be ordered by sending a request without payment; it holds capacity
**Independent Test**: mark Monday on request → slots flag it; send a request → `requested`, capacity −1; standard window via request route → 400; on-request cart via complete → 400

### Tests for User Story 1

- [ ] T012 [US1] Integration tests in `apps/backend/integration-tests/http/pickup-requests.spec.ts` (helpers modelled on `pickup-scheduling.spec.ts`; mark Monday windows on request via the catering module service; carts 12 × test-mini-tarta = 144 zł; no payment collection for requests): slots show `requires_confirmation: true` on Mondays and hide Mondays inside 72 h; `POST /store/catering/requests` → 200 `requested`, `response_deadline` within now+24 h ±1 min, `items` snapshot; repeat → same request (idempotent); day capacity counts it (`daily_capacity` 1 → day `full`); standard window → 400 `Ten termin nie wymaga potwierdzenia — złóż zwykłe zamówienie.`; below minimum → 400 minimum message; `POST /store/carts/:id/complete` for an on-request cart without a request → 400 `Ten termin wymaga potwierdzenia kuchni — wyślij zapytanie.`; `GET /store/catering/requests/:cart_id` → `requested`; unknown cart → 404

### Implementation for User Story 1

- [ ] T013 [US1] Workflow `apps/backend/src/workflows/send-pickup-request.ts`: step (under `withCapacityLock(term.date)`) — load cart (T011), `assertCartOrderRules`, `checkTerm` must pass and the window must be `requires_confirmation` (else the "nie wymaga potwierdzenia" error); return the existing `requested`/`confirmed` booking for the cart if any; else create booking `{ status: "requested", requires_confirmation: true, response_deadline, request_snapshot }`; compensation deletes the created booking
- [ ] T014 [P] [US1] Store route `apps/backend/src/api/store/catering/requests/route.ts` (`POST { cart_id }` → `{ request }` per contract §2) and `apps/backend/src/api/store/catering/requests/[cart_id]/route.ts` (`GET` → latest booking of the cart with `requires_confirmation`, shape §2 + `order_id` when `active`, 404 otherwise); request DTO mapper in `apps/backend/src/lib/request-dto.ts`
- [ ] T015 [P] [US1] Zod body validator `{ cart_id: string }` in `apps/backend/src/api/validators/catering-scheduling.ts` registered for `POST /store/catering/requests` in `apps/backend/src/api/middlewares.ts`
- [ ] T016 [US1] In `apps/backend/src/lib/pickup-booking.ts` `reservePickupTerm`: when the term's window `requires_confirmation`, do NOT create an `active` booking — throw `Ten termin wymaga potwierdzenia kuchni — wyślij zapytanie.` unless a confirmed request exists (the confirmed branch itself is US3/T024)

**Checkpoint**: US1 passes; standard 004 flow unchanged

---

## Phase 4: User Story 2 - Staff confirm or decline (Priority: P1)

**Goal**: staff decide from the request list and the calendar
**Independent Test**: confirm → `confirmed` with `payment_deadline`; decline → `declined`, capacity freed; confirm after response deadline → 409

### Tests for User Story 2

- [ ] T017 [US2] Add to `apps/backend/integration-tests/http/pickup-requests.spec.ts` (admin token as in `pickup-scheduling.spec.ts`): `GET /admin/catering/requests?status=requested` lists the request with email, items and deadline; confirm → 200 `confirmed`, `payment_deadline` ≈ now + 24 h; second confirm → 409; decline a requested one → `declined`, slot available again, status route shows `declined`; decline a confirmed one → `declined`; confirm a request whose `response_deadline` was set in the past (module service) → 409; calendar entry carries `booking_status: "requested"` and `request_id`

### Implementation for User Story 2

- [ ] T018 [P] [US2] Workflows `apps/backend/src/workflows/confirm-pickup-request.ts` and `apps/backend/src/workflows/decline-pickup-request.ts` using `canConfirm`/`canDecline` (T009); confirm sets `status: "confirmed"`, `payment_deadline`, `decided_at`, `decided_by` (Admin user id); decline sets `declined`, `decided_at`, `decided_by`; violations → `MedusaError.Types.CONFLICT`; compensation restores previous fields
- [ ] T019 [US2] Admin routes `apps/backend/src/api/admin/catering/requests/route.ts` (`GET ?status&from&to`, contract shape, sorted by nearest deadline, item titles + email + `item_total` via `query.graph` on `cart`) and `apps/backend/src/api/admin/catering/requests/[id]/confirm/route.ts`, `.../[id]/decline/route.ts` (`req.auth_context.actor_id` as `decided_by`); query validator in `apps/backend/src/api/middlewares.ts`
- [ ] T020 [US2] Extend `apps/backend/src/api/admin/catering/calendar/route.ts`: entries gain `booking_status`, and for requests `request_id`, `cart_id`, `email`, `response_deadline`/`payment_deadline` (email from the cart when there is no order) per [contracts/admin-api.md](contracts/admin-api.md)
- [ ] T021 [P] [US2] Admin page `apps/backend/src/admin/routes/pickup-requests/page.tsx` (`defineRouteConfig({ label: "Zapytania" })`): tabs Oczekujące / Potwierdzone / Zakończone; each row: term, email, items, total, deadline countdown ("odpowiedz do …" / "płatność do …"); buttons Potwierdź / Odrzuć (decline asks for confirmation); reuse `apps/backend/src/admin/lib/catering-api.ts`
- [ ] T022 [P] [US2] `apps/backend/src/admin/routes/pickups/page.tsx`: show requests with a badge ("Zapytanie", "Potwierdzone – czeka na płatność") and link to "Zapytania"
- [ ] T023 [US2] Reschedule of requests (spec edge case): `apps/backend/src/workflows/reschedule-order-pickup.ts` accepts `booking_id` as an alternative to `order_id` and updates `cart.metadata.catering_term` instead of order metadata when the booking has no order; add `POST /admin/catering/requests/:id/pickup-term` in `apps/backend/src/api/admin/catering/requests/[id]/pickup-term/route.ts` reusing the 004 warnings/confirm logic; state and deadlines unchanged

**Checkpoint**: US1 + US2 pass

---

## Phase 5: User Story 3 - Customer pays after confirmation (Priority: P1)

**Goal**: only a confirmed, unexpired, unchanged request can be paid; payment makes it an order
**Independent Test**: confirm → pay the same cart → order, booking `active` with `order_id`; pay unconfirmed / expired / changed → 400

### Tests for User Story 3

- [ ] T024a [US3] Add to `apps/backend/integration-tests/http/pickup-requests.spec.ts`: confirmed request → payment collection + `pp_system_default` session → complete → `type: "order"`, status route `active` with `order_id`, calendar `booking_status: "active"`; complete while `requested` → 400 "wymaga potwierdzenia"; `payment_deadline` set to the past → 400 `Czas na płatność za to zamówienie minął.`; quantity changed after request → 400 `Zamówienie różni się od wysłanego zapytania — skontaktuj się z nami.`; declined → 400 "minął"/"wymaga" per state

### Implementation for User Story 3

- [ ] T024 [US3] In `apps/backend/src/lib/pickup-booking.ts` + `apps/backend/src/workflows/hooks/complete-cart-validate.ts`: on-request window → find the cart's `confirmed` booking; `canPay(booking, now)` else deadline error; `snapshotMatches` else mismatch error; set `status: "active"` and return the booking id + previous status for compensation (compensation sets it back to `confirmed`); standard windows keep the 004 path
- [ ] T025 [US3] Verify `apps/backend/src/subscribers/pickup-booking-order-placed.ts` links `order_id` for a booking that was `confirmed` → `active` (query by `cart_id` with `status: "active"` already matches); adjust if needed

**Checkpoint**: US1–US3 pass — full request → confirm → pay flow

---

## Phase 6: User Story 4 - Automatic expiry (Priority: P1)

**Goal**: unanswered and unpaid requests end by themselves and free capacity
**Independent Test**: deadlines in the past + run the job → `expired` / `canceled`, capacity freed, status route explains

### Tests for User Story 4

- [ ] T026 [US4] Add to `apps/backend/integration-tests/http/pickup-requests.spec.ts`: set `response_deadline` / `payment_deadline` in the past via the module service, call the job's exported handler with the test container → `expired` / `canceled`, slots available again, status route shows the state; a request with a future deadline is untouched

### Implementation for User Story 4

- [ ] T027 [US4] Scheduled job `apps/backend/src/jobs/expire-pickup-requests.ts` (`config = { name: "expire-pickup-requests", schedule: "*/5 * * * *" }`): load `requested`/`confirmed` bookings with a deadline ≤ now, `selectExpired` (T009), update statuses (per-date `withCapacityLock`), log counts; export the handler for tests

**Checkpoint**: all P1 stories pass

---

## Phase 7: User Story 5 - Staff configure on-request terms (Priority: P2)

**Goal**: staff mark windows/weekdays on request and set the three times
**Independent Test**: Admin schedule round-trip with the new fields; new deadlines follow new values, existing deadlines unchanged

### Tests for User Story 5

- [ ] T028 [US5] Add to `apps/backend/integration-tests/http/pickup-requests.spec.ts`: `POST /admin/catering/schedule` with `request_lead_time_hours`, `request_response_hours`, `request_payment_hours` and windows with `requires_confirmation` → round-trip; out-of-range values (`request_response_hours: 0` / `169`) → 400; omitted `requires_confirmation` → `false`; changing `request_response_hours` changes the deadline of a new request but not of an existing one

### Implementation for User Story 5

- [ ] T029 [US5] Extend `apps/backend/src/modules/catering/scheduling/validate-schedule.ts` (+ unit tests in `__tests__/validate-schedule.unit.spec.ts`) for the new ranges "≥ 0" and "1–168"; `apps/backend/src/api/validators/catering-scheduling.ts` (`AdminScheduleBody`: new numbers, window `requires_confirmation` optional default false); `apps/backend/src/workflows/update-pickup-schedule.ts` and `apps/backend/src/lib/schedule-dto.ts` persist/return them (snapshot/compensation included)
- [ ] T030 [US5] `apps/backend/src/admin/routes/settings/pickup-schedule/page.tsx`: per-window "na zapytanie" toggle, per-weekday "cały dzień na zapytanie" toggle, three number fields ("Wyprzedzenie zapytań (godz.)", "Czas na odpowiedź (godz.)", "Czas na płatność (godz.)"); `apps/backend/src/admin/lib/catering-api.ts` `Schedule` type updated

**Checkpoint**: all stories pass

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T031 [P] Emit `catering.request.created|confirmed|declined|expired|canceled` (event bus, payload `{ id, cart_id }`) from the send/confirm/decline workflows and the job, for the future e-mail feature (research R-09)
- [ ] T032 [P] `apps/backend/AGENTS.md` "Kontrakty dla storefrontu": on-request section linking [contracts/store-api.md](contracts/store-api.md); completion order now min → invoice → term → (on-request) confirmed/deadline/snapshot; add a note to `specs/004-pickup-scheduling/contracts/store-api.md` §1 about the new `requires_confirmation` field
- [ ] T033 Run `pnpm run lint`, `pnpm run typecheck`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `pnpm run test:unit` in `apps/backend`
- [ ] T034 Run `pnpm run test:integration:http -- integration-tests/http/pickup-requests.spec.ts integration-tests/http/pickup-scheduling.spec.ts integration-tests/http/pickup-order-rules.spec.ts` and record results here (constitution VI)
- [ ] T035 Manual check per [quickstart.md](quickstart.md) on dev after migration + seed (Admin pages via API; note if not clicked in a browser)

---

## Dependencies & Execution Order

- Setup (T001) → Foundational (T002–T011) → stories
- **US1** needs Foundational
- **US2** needs US1 (requests must exist)
- **US3** needs US2 (confirmation)
- **US4** needs US1 (+ US2 for the "confirmed → canceled" case); independent of US3
- **US5** needs Foundational only for the backend part (T029); its tests use requests (US1)
- Polish after the stories you ship

### Parallel Opportunities

- T002 ∥ T003 ∥ T004; T008 ∥ T010 once T007/T009 exist
- US1: T014 ∥ T015; US2: T018 ∥ T021 ∥ T022
- US4 (T026–T027) ∥ US3 after US2; US5 T029–T030 ∥ US2–US4 (coordinate `middlewares.ts`, `catering-scheduling.ts` validators)

## Parallel Example: Foundational

```bash
Task: "T002 requires_confirmation on WindowRule in apps/backend/src/modules/catering/models/window-rule.ts"
Task: "T003 request_* fields on FulfillmentSchedule in apps/backend/src/modules/catering/models/fulfillment-schedule.ts"
Task: "T004 Booking statuses and request fields in apps/backend/src/modules/catering/models/booking.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T018 confirm/decline workflows in apps/backend/src/workflows/"
Task: "T021 Zapytania page in apps/backend/src/admin/routes/pickup-requests/page.tsx"
Task: "T022 request badges in apps/backend/src/admin/routes/pickups/page.tsx"
```

## Implementation Strategy

### MVP

Foundational + US1 + US2 + US3 + US4 together — a request flow without expiry would block
capacity forever, and without payment it never becomes an order. Ship them as one increment;
la-palette-garden can start the request UI against the contract after US1.

### Incremental Delivery

1. Foundational → US1 (requests visible in calendar only via API) → US2 → US3 → US4 → deploy
2. US5 (staff self-service) → deploy; until then on-request windows are set via a script or the
   module service
