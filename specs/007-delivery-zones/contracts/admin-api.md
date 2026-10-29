# Admin API contract: delivery

Used only by our Admin extensions (`src/admin`). Session-authenticated like the other
`/admin/catering/*` routes. Amounts in gross PLN, major units.

## Delivery zones

- `GET /admin/catering/delivery-zones` →
  `{ delivery_zones: [{ id, name, price, min_order_value, postal_codes: ["31-762", "32-005"] }] }`,
  sorted by name; codes sorted.
- `POST /admin/catering/delivery-zones` `{ name, price, min_order_value?, postal_codes }`
  → `{ delivery_zone }`. The Admin page splits the pasted text on commas, spaces and newlines
  before sending.
- `POST /admin/catering/delivery-zones/:id` (same body, full replace of codes) →
  `{ delivery_zone }`.
- `DELETE /admin/catering/delivery-zones/:id` → `{ id, deleted: true }`.

Validation (400 `invalid_data`, Polish): name required and unique; price ≥ 0; minimum ≥ 0 or
null; at least one code; every code `XX-XXX` →
`Nieprawidłowe kody pocztowe: 31-7, 3187. Użyj formatu XX-XXX.`; duplicates inside the request
are merged; codes used by another zone →
`Kody 31-870, 31-871 są już w strefie „Strefa 2”.`

- `GET /admin/catering/delivery-zones/match?postal_code=31-870` →
  `{ postal_code, valid, zone: { id, name } | null }` — the
  "check a postal code" field on the zones page.

## Schedule (004) — extended

`GET|POST /admin/catering/schedule?method=delivery` works as for pickup. The body/response
gains `max_orders_per_window` (number ≥ 1 or `null`); for pickup it is always `null` and a
non-null value is refused.

## Requests (005) — extended

- List and detail entries gain `fulfillment: { method, address, phone, postal_code, zone_name,
  out_of_zone, delivery_cost }` (`address`/`phone` null for pickup).
- `POST /admin/catering/requests/:id/confirm` body `{ delivery_cost?: number }`:
  - out-of-zone delivery request: `delivery_cost` (≥ 0) **required**, else 400
    `Podaj koszt dostawy.`;
  - any other request: `delivery_cost` refused (400).
  On success the cart's delivery method is re-priced to that cost.

## Calendar (004) and order term (004 FR-015) — extended

- Calendar entries gain `method` and, for delivery, `address`, `phone`, `zone_name`,
  `delivery_cost`; windows of the delivery schedule appear with `used/max` when a maximum is
  set.
- Reschedule of a delivery order/request offers delivery windows; a full window gives the
  warning `window_full` (confirmable), next to the existing ones.

## Order rules widget

Store metadata `catering_free_delivery_threshold` is written by the existing order-rules
widget through Medusa's store update (no new route); empty value removes the key.
