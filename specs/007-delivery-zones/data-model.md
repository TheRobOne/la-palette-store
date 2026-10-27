# Data Model: City Delivery in Postal-Code Zones

All new data lives in the catering module (`src/modules/catering`) unless noted. Amounts are
gross PLN in major units (`30` = 30 zł), like the minimum order value.

## Changed: `FULFILLMENT_METHODS`

`["pickup"]` → `["pickup", "delivery"]` (`models/fulfillment-schedule.ts`). Affects the enum
columns of `fulfillment_schedule`, `window_rule`, `blocked_date`, `booking` (one migration).

## Changed: `fulfillment_schedule`

| Field | Type | Rule |
|---|---|---|
| `max_orders_per_window` | number, nullable | ≥ 1 when set; null = no per-window limit. Pickup: null. Delivery default (setup): 2. |

All other fields (lead time, horizon, request times, `is_enabled`) now also have a `delivery`
row.

## New: `delivery_zone`

| Field | Type | Rule |
|---|---|---|
| `id` | id `dzone_` | |
| `name` | text | required, unique among non-deleted zones (e.g. "Strefa 1") |
| `price` | number | ≥ 0, gross PLN |
| `min_order_value` | number, nullable | ≥ 0; null = only the global minimum applies |
| `codes` | hasMany `delivery_zone_code` | at least one code |

## New: `delivery_zone_code`

| Field | Type | Rule |
|---|---|---|
| `id` | id `dzcode_` | |
| `zone` | belongsTo `delivery_zone` | cascade delete with the zone |
| `code` | text | full postal code `^\d{2}-\d{3}$` |

Unique index `(code)` where `deleted_at IS NULL` — a code belongs to at most one zone. The save
workflow checks it first and answers 400 naming the other zone (the index is the safety net).

## Changed: `booking`

| Field | Type | Rule |
|---|---|---|
| `delivery_postal_code` | text, nullable | `XX-XXX`; delivery only |
| `delivery_zone_id` | text, nullable | matched zone at booking time; null = out of zone |
| `delivery_zone_name` | text, nullable | name at booking time (history survives renames/deletes) |
| `delivery_cost` | number, nullable | in zone: price paid; out of zone: set by staff on confirm |

Capacity statuses are unchanged (`requested`, `confirmed`, `active`). A booking counts against
its date (all methods) and, for a method with `max_orders_per_window`, against its window
(same method, date, start, end).

`request_snapshot` gains `delivery: { postal_code }` for delivery requests; payment requires
the cart's postal code to equal it (005 FR-009a).

## Store metadata (no table)

| Key | Type | Rule |
|---|---|---|
| `catering_free_delivery_threshold` | number or empty | > 0; empty/absent = no free delivery (launch) |

Edited in the "Order rules" widget beside `catering_min_order_value`.

## Cart / order fields used (Medusa-native)

- `shipping_address`: `first_name`, `last_name`, `address_1`, `postal_code`, `city`, `phone`,
  `country_code: "pl"` — required for delivery, empty for pickup.
- `shipping_methods[0]`: the "Dostawa" option (`type.code: "delivery"`, calculated) or the
  pickup option (`type.code: "pickup"`); its `amount` is the delivery cost.
- `metadata.catering_term.method`: `"pickup"` or `"delivery"`; must equal the shipping
  option's `type.code`.

## Derived: delivery quote (pure function)

```
quote(postalCode, itemTotal, zones, freeThreshold, confirmedCost?) →
  { status: "invalid" }
  | { status: "in_zone", zone, amount, min_order_value }
  | { status: "out_of_zone", amount: confirmedCost ?? null }
```

- `invalid` unless the code (trimmed) matches `^\d{2}-\d{3}$`;
- match: the zone whose code list contains it, otherwise none;
- `amount` in zone = 0 when `freeThreshold` is set and `itemTotal ≥ freeThreshold`, else
  `zone.price`;
- effective minimum = max(global minimum, `zone.min_order_value` ?? 0);
- out of zone always requires confirmation (`requires_confirmation: true` for every window).

## Derived: window availability (extends 004)

A window is available when the 004 rules hold **and**, if `max_orders_per_window` is set,
`bookingsPerWindow[date|start|end] < max_orders_per_window`. Day-level reason stays `full`
only for the daily capacity; a window full by the per-window limit has `available: false`
and `reason: "window_full"` (new window-level field).

## State transitions

Unchanged from 005. New guard on `requested → confirmed`: for an out-of-zone delivery request
`delivery_cost` (≥ 0) is required and stored; for any other request it is not accepted.
