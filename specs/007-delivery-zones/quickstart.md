# Quickstart: City Delivery in Postal-Code Zones

## Prerequisites

- Backend on this branch; `medusa db:migrate` and seed run (`pnpm dev` runs both) — setup
  creates the "Dostawa" option, the delivery schedule and the two example zones (research R-11).
- Admin user; publishable API key for Store calls.
- Integration tests: dev PostgreSQL (README "Integration tests"):
  `pnpm run test:integration:http -- integration-tests/http/delivery.spec.ts`; existing
  `pickup-order-rules`, `pickup-scheduling`, `pickup-requests` and `notifications` suites must
  still pass (SC-006).

## Validation scenarios

- **V1 Zone quote (US1, US2)**: `GET /store/catering/delivery-quote?postal_code=31-763` →
  `in_zone`, "Strefa 1", 30; `?postal_code=32-005` → "Strefa 1" (code outside Kraków);
  `?postal_code=30-001` → "Strefa 2", 50; `?postal_code=34-500` → `out_of_zone`;
  `?postal_code=31763` → `invalid` ([contracts/store-api.md §4](contracts/store-api.md)).
- **V2 In-zone order (US1)**: cart with items ≥ 100 zł → set `shipping_address` with 31-870 →
  `listCartOptions` lists "Dostawa" (`type.code: "delivery"`, 30) → add it → choose a window
  from `slots?method=delivery` → pay and complete → order has the address, `shipping_total`
  30, `catering_term.method: "delivery"`; the calendar shows it with address and zone.
- **V3 Re-pricing**: change the cart's postal code to 30-001 → `shipping_total` becomes 50
  without another call; set a free-delivery threshold of 300 zł and add items above it → 0.
- **V4 Backend refuses (constitution VIII)**: cart priced in Strefa 1, then staff change its
  price in the Admin → complete → 400 `Koszt dostawy się zmienił…`; delivery without phone →
  400 `Uzupełnij adres dostawy: telefon.`; pickup term with the delivery option → 400.
- **V5 Admin zones (US2)**: paste "31-870, 31-871\n31-872" into Strefa 2 → saved, match tool
  shows Strefa 2 for 31-871; add 31-870 to Strefa 1 as well → 400 naming Strefa 2; paste
  "31-7" → 400 naming the invalid entry.
- **V6 Out of zone (US3)**: cart with 34-500 → send request on a standard window → accepted;
  confirm without a cost → 400 `Podaj koszt dostawy.`; confirm with 80 → status page shows
  `delivery_cost: 80`, cart `shipping_total` 80 → pay → order with 80; change the postal code
  before paying in another request → payment refused.
- **V7 Delivery schedule (US4)**: set max 2 per window; place two delivery orders in Saturday
  12–14 → slots show that window `available: false, reason: "window_full"`, other windows and
  pickup still available; two parallel completions for the last place → exactly one succeeds
  (SC-007); block a date for delivery only → pickup still offered.
- **V8 E-mails (US5)**: delivery order → log shows `order-confirmation` with the address and the
  delivery line, `staff-new-order` subject "— dostawa …"; reschedule → "Zmiana terminu
  dostawy"; reminder job the day before → "Jutro dostawa…" without the venue map link
  ([contracts/emails.md](contracts/emails.md)).
- **V9 Pickup unchanged (SC-006)**: full pickup checkout as in 004/005 passes with no
  `shipping_address`.

Contracts: [store-api.md](contracts/store-api.md), [admin-api.md](contracts/admin-api.md),
[emails.md](contracts/emails.md); data: [data-model.md](data-model.md).
