# Research: Pickup Scheduling

All findings for Medusa were verified against the installed **2.21.1** source in `node_modules`
(core-flows, workflows-sdk, utils, types), because docs.medusajs.com does not cover these
internals. File references are to the compiled `dist/` code.

## R-01 Where the chosen term lives on the cart → `cart.metadata.catering_term`

- **Decision**: the storefront stores the term as one object under
  `cart.metadata.catering_term = { method: "pickup", date: "YYYY-MM-DD", start: "HH:mm",
  end: "HH:mm" }`. `completeCartWorkflow` copies `cart.metadata` to `order.metadata`
  (`core-flows/dist/cart/workflows/complete-cart.js`, `metadata: cart.metadata`), so the order
  carries the term for confirmation and order history with no extra code.
- **Rationale**: the Store API accepts `metadata` on `POST /store/carts/:id` (validator
  `UpdateCart.metadata`), the same mechanism the invoice feature already uses; updates are a
  **shallow merge** (`utils/dist/common/merge-metadata.js` applied in
  `medusa-internal-service.js` update): top-level keys from other features (invoice) survive,
  and the nested `catering_term` object is replaced as a whole, which is exactly what a term
  change needs. Sending `catering_term: ""` removes it.
- **Alternatives considered**: a module link cart ↔ booking created when the customer picks a
  term — rejected: it needs a custom Store API write route and would reserve capacity for
  abandoned carts (spec: a cart does not reserve a place). The capacity record is created only
  at completion (R-03).

## R-02 Capacity unit and scope

- **Decision**: daily capacity = number of active bookings (placed, not cancelled orders) per
  date, kitchen-wide across all fulfillment methods (spec clarification 2026-10-06, FR-009,
  FR-011). No per-window limit.
- **Alternatives considered**: portions/pieces (mixed units piece/portion/person), order value —
  rejected in clarification.

## R-03 Overbooking protection → booking row created inside the `validate` hook under a lock, compensated on failure

- **Problem**: `completeCartWorkflow` locks only the **cart id** (`acquireLockStep({ key:
  input.id })`), so two different carts for the same last place are not serialised. A check in
  the `validate` hook alone is not enough either: the order is created several steps later, so
  two carts could both pass the check before either order exists.
- **Decision**: the existing single `validate` handler (`src/workflows/hooks/
  complete-cart-validate.ts`, a hook accepts only one handler — `workflows-sdk/dist/utils/
  composer/create-hook.js` throws "Cannot define multiple hook handlers") is extended:
  1. run the existing checks (minimum order value, invoice);
  2. inside `lockingModule.execute("catering:capacity:<date>", job, { timeout: 5 })` count
     active bookings for the date, re-check every term rule, and **create a booking row**
     (`cart_id`, method, date, start, end, status `active`) in the catering module;
  3. return `new StepResponse(undefined, bookingId)`; the hook's **compensation** (second
     argument of `hooks.validate(invoke, compensate)`, supported by `createHook`) deletes that
     booking if a later step fails (payment authorisation, order creation).
  The booking is the capacity record: the lock covers check + insert, so the second cart sees
  the first booking. Lock timeout → `invalid_data` "Spróbuj ponownie za chwilę".
- **Idempotency**: `validate` runs again when a completion is retried (it precedes the
  `when("create-order")` branch). If an active booking already exists for this `cart_id` with
  the same term, the handler accepts it without counting it twice and without compensation.
- **Locking provider**: Medusa's default in-memory locking in dev/staging (single process,
  `MEDUSA_WORKER_MODE=shared`), Redis provider in production — already required by the
  constitution for production. Verified (T001): `@medusajs/medusa/locking` is in
  `defineConfig`'s `defaultModules` (`utils/dist/common/define-config.js`), so
  `container.resolve(Modules.LOCKING)` works without an entry in `medusa-config.ts`; the Redis
  variant (`locking-redis`) is selected there when Redis is configured.
- **Alternatives considered**: a DB unique constraint per (date, seat number) — awkward with a
  configurable capacity; `SELECT … FOR UPDATE` on a per-day row — not exposed through module
  services, would need raw SQL; checking in the undocumented `orderCreated` hook — it is
  `@ignore` and not listed in the workflow's public `hooks`.

## R-04 Linking a booking to its order and cancellations

- **Decision**: the booking stores `cart_id` at creation; a subscriber on `order.placed` sets
  `order_id` (event payload `{ id }`, cart resolved through the core `order_cart` link that
  `completeCartWorkflow` itself queries). A subscriber on `order.canceled` sets the booking's
  status to `canceled`, freeing the place (spec US2 scenario 3).
- **Rationale**: documented events instead of internal hooks; plain id fields keep the module
  isolated (read-only use, no cross-module FK).
- **Alternatives considered**: a module link booking ↔ order — not needed: the calendar reads
  bookings and fetches order summaries by id in one `query.graph` call.

## R-05 Time zone and DST without a new dependency

- **Decision**: all rules are wall-clock values in Europe/Warsaw (`date` as `YYYY-MM-DD`,
  times as `HH:mm`). Converting a window start to an instant uses a small helper
  (`src/modules/catering/scheduling/time.ts`) based on `Intl.DateTimeFormat` with
  `timeZone: "Europe/Warsaw"`: compute the zone offset for the candidate instant and correct
  once (handles both DST transitions). "Today", weekday and lead time are computed from that.
- **Rationale**: Node 20+/24 ships full ICU; windows are 10:00–18:00 so the non-existent /
  repeated hour (02:00–03:00) never occurs in practice, but the helper is still deterministic
  for it. Unit tests cover 2026-03-29 (spring forward) and 2026-10-25 (fall back).
- **Alternatives considered**: `date-fns-tz` / `luxon` — a new runtime dependency for ~30 lines
  (Principle VII).

## R-06 Where settings live

- **Decision**: in the catering module: `scheduling_settings` (singleton: `daily_capacity`),
  `fulfillment_schedule` (per method: `lead_time_hours`, `booking_horizon_days`,
  `is_enabled`), `window_rule` (per method + ISO weekday), `blocked_date` (date, method or
  `null` = all methods, reason).
- **Rationale**: these are structured, per-method and edited on a dedicated Admin page;
  store metadata (used for the single scalar minimum order value) does not fit lists.

## R-07 Admin surfaces

- **Decision**: (a) Admin UI route "Odbiory" (`src/admin/routes/pickups/page.tsx`, sidebar
  item) — calendar list of upcoming days: windows, orders, used/total capacity, blocked
  marker, block/unblock action; (b) settings route `src/admin/routes/settings/pickup-schedule/`
  — weekly windows, lead time, horizon, capacity, blocked dates; (c) widget on order details
  (`order.details.side.before`) — the term, previous term, reschedule form with warnings.
  Custom admin API routes under `/admin/catering/*` (contracts/admin-api.md); mutations go
  through workflows (Principle I).
- **Rationale**: the input asked for "widget kalendarza"; a full calendar does not fit any
  existing page zone, so it becomes a route (still `admin-sdk`); the order widget covers the
  per-order view and rescheduling.

## R-08 Availability computation as a pure function

- **Decision**: `computeAvailability({ now, from, to, method, schedule, windows, blockedDates,
  bookingsPerDate, dailyCapacity })` in `src/modules/catering/scheduling/availability.ts`,
  no I/O — used by the Store route, the completion check and the Admin reschedule warnings.
  Unit-tested without a database (constitution CI rule).

## R-09 Payment already taken when the term fails (FR-005)

- **Finding**: `completeCartWorkflow` runs `compensatePaymentIfNeededStep` and authorises the
  payment as the last step, so with the system provider no money moves on rejection. For
  Przelewy24 (spec 005, payment before completion) the same compensation step refunds a
  captured payment; spec 005 must test "term no longer available after payment".

## R-10 Version check (constitution: latest versions)

- Registry on 2026-10-06: `@medusajs/medusa` 2.21.2 (installed 2.21.1), `typescript` 7.0.2
  (backend on ^6.0.3).
- **Decision (owner, 2026-10-06)**: TypeScript stays on major 6; Medusa patch/minor releases
  are not a concern of feature plans. No upgrade in this feature.
