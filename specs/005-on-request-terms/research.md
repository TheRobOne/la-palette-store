# Research: On-Request Pickup Terms

Medusa findings verified against the installed **2.21.1** source in `node_modules`.

## R-01 What a "request" is in Medusa → a cart with a booking, the order is created on payment

- **Finding**: an order is created only by `completeCartWorkflow`, which runs
  `validateCartPaymentsStep` and throws "Payment sessions are required to complete cart" unless
  the cart has a processable payment session (`core-flows/dist/cart/steps/validate-cart-payments.js`).
  The Store API creates payment collections **only for carts**
  (`StoreCreatePaymentCollection = { cart_id }`, `medusa/dist/api/store/payment-collections/validators.js`);
  there is no Store route to pay an existing order.
- **Decision**: a request is the customer's **cart** plus a catering **booking** in state
  `requested` (it holds capacity) and a snapshot of what was sent. Nothing is completed when
  the request is sent. After staff confirm, the customer pays that same cart through the
  normal checkout payment step and `POST /store/carts/:id/complete`; the order is created
  then, and the booking becomes `active`.
- **Rationale**: Medusa-native (Principle I); the order list contains only binding, paid
  orders (constitution II: "a request is not a binding order"); Przelewy24 (later feature)
  works on the confirmed cart exactly as on a standard cart — no "pay an existing order"
  extension needed.
- **Alternatives considered**:
  - completing the cart at request time with a fake "pay later" provider and adding a second
    payment collection later — fights the Store API (no order payment route), puts unpaid
    requests into the order list, needs a custom provider;
  - Medusa draft orders (`@medusajs/draft-order` is installed) — built for staff-created orders,
    no customer-facing payment of a draft through the Store API.
- **Spec impact**: "on the order" in US2/FR-006 became "in the request list" (requests are not
  orders yet); FR-009a added (pay exactly what was requested).

## R-02 Booking states instead of a new entity

- **Decision**: extend the 004 `booking` (already keyed by `cart_id`) with the request state
  and deadlines rather than a new model. `status` becomes
  `requested | confirmed | active | declined | expired | canceled`; capacity counts
  `requested`, `confirmed` and `active`. Standard orders keep going straight to `active`.
- **Rationale**: one capacity record per cart already exists; the calendar, lock key and
  counting logic from 004 keep working with an extended status filter.
- **Alternatives**: separate `request` model linked to booking — two records for one thing.

## R-03 Sending a request → custom Store route under the 004 capacity lock

- **Decision**: `POST /store/catering/requests { cart_id }`. Under
  `catering:capacity:<date>` (004 `withCapacityLock`) it runs the same checks as completion —
  minimum order value, invoice data, `parseTerm`, `checkTerm` with the **request** lead time —
  plus "the window is on request" (FR-003a), then creates the booking `requested` with
  `response_deadline` and a snapshot of the cart (variant ids, quantities, term). Idempotent:
  an existing `requested`/`confirmed` booking for the cart is returned.
- **Cart totals**: the route reads the cart with `query.graph` including `item_total`,
  `metadata`, `billing_address.*`, `items.*` — the same computed fields
  `completeCartWorkflow` reads (`completeCartFields`), so the shared validators work unchanged.
- **Alternatives**: completing via a hook branch — impossible without a payment session (R-01).

## R-04 Paying after confirmation → the existing completion hook decides the path (FR-003a)

- **Decision**: the single `completeCartWorkflow.hooks.validate` handler gets one more branch:
  - term window **on request** → require a booking `confirmed` for this cart, `now <=
    payment_deadline`, and the cart matching the snapshot (FR-009a); then mark it `active`
    (compensation: back to `confirmed`). Otherwise reject: "Ten termin wymaga potwierdzenia
    kuchni — wyślij zapytanie." / "Czas na płatność minął…" / "Zamówienie różni się od
    wysłanego zapytania…".
  - standard window → unchanged 004 behaviour (book `active` under lock).
- **Rationale**: one place enforces all completion rules; payment is refused after the
  deadline even if the expiry job has not run yet (spec edge case).

## R-05 Expiry → Medusa scheduled job every 5 minutes

- **Decision**: `src/jobs/expire-pickup-requests.ts`, schedule `*/5 * * * *`: `requested` past
  `response_deadline` → `expired`; `confirmed` past `payment_deadline` → `canceled`. Pure
  selection logic in a tested function; SC-001 allows ≤ 15 min delay.
- **Rationale**: Medusa-native scheduled jobs; no extra infrastructure (Principle VII). The job
  runs in the shared worker (`MEDUSA_WORKER_MODE=shared`).
- **Alternatives**: workflow `sleep`/timers per request — heavier, harder to test; lazy expiry
  only on read — capacity counts would stay wrong until someone reads.

## R-06 Deadlines

- `response_deadline = min(sent_at + response_hours, window_start)`;
  `payment_deadline = min(confirmed_at + payment_hours, window_start)` (spec edge case: never
  past the pickup). Window start computed with the 004 Warsaw helper.
- Defaults: request lead time 72 h, response 24 h, payment 24 h (spec Assumptions).

## R-07 Customer status page → by cart id

- **Decision**: `GET /store/catering/requests/:cart_id` returns state, deadlines and the
  request snapshot. The cart id is already the customer's secret handle in Medusa (the Store
  API serves any cart by id); the storefront builds the status link from it.
- **Alternatives**: a separate random token — adds a field and no real protection beyond the
  cart id.

## R-08 Admin

- Calendar (004) shows `requested`/`confirmed` bookings with badges and deadlines.
- New Admin route "Zapytania" (list by state, sorted by deadline) with Confirm / Decline.
- Admin API: `GET /admin/catering/requests`, `POST /admin/catering/requests/:id/confirm`,
  `POST /admin/catering/requests/:id/decline` (workflows, Principle I).
- Settings page (004) gains the per-window "na zapytanie" toggle (and per-weekday toggle) and
  three numbers per method.
- Staff reschedule (004 US5) of a `requested`/`confirmed` booking keeps its state and
  deadlines; the existing workflow already ignores status beyond "not canceled".

## R-09 Customer information

- Status page only in this feature (FR-010); the e-mail feature will subscribe to new events
  emitted here: `catering.request.created|confirmed|declined|expired|canceled` (emitted via
  the event bus in the workflows/job, unused for now).

## R-10 Verification (T001)

- Scheduled jobs: `medusa/dist/loaders/index.js` loads `src/jobs` when `workerMode` is
  `worker` or `shared` (lines 29–30); dev/staging use `shared`. A job needs
  `config.name` and `config.schedule` (`framework/dist/jobs/job-loader.js` 35–41).
- Cart totals outside a workflow: `completeCartWorkflow` reads `item_total` etc. through
  `useQueryGraphStep`, i.e. the same `query.graph` API a route uses; the request route reads
  the cart the same way (confirmed empirically by the minimum-order test in T012).
