# Data Model: Pickup Scheduling

All new models belong to the existing **catering** module (`src/modules/catering/models/`),
one migration. Dates are wall-clock dates in Europe/Warsaw stored as `text` `YYYY-MM-DD`;
times are `text` `HH:mm` (24 h, zero-padded). `fulfillment_method` is an enum with one value
today: `pickup` (adding `delivery` = enum value + its own rows, FR-011).

## SchedulingSettings (singleton)

| Field | Type | Rules |
|---|---|---|
| id | id `schset` | one row, created by the setup script |
| daily_capacity | number | ≥ 0; 0 = no orders accepted; default 10 |

Kitchen-wide: counts bookings of **all** methods (R-02).

## FulfillmentSchedule

| Field | Type | Rules |
|---|---|---|
| id | id `fsched` | |
| fulfillment_method | enum `pickup` | unique |
| is_enabled | boolean | default true; disabled → no terms offered for the method |
| lead_time_hours | number | ≥ 0; default 48; measured to the window **start** |
| booking_horizon_days | number | 1–365; default 60; last offered date = today + horizon |

## WindowRule

| Field | Type | Rules |
|---|---|---|
| id | id `wrule` | |
| fulfillment_method | enum `pickup` | |
| weekday | number | ISO 1 = Monday … 7 = Sunday |
| start_time | text `HH:mm` | < end_time |
| end_time | text `HH:mm` | |

Validation: windows of the same method and weekday MUST NOT overlap; duplicates rejected.
Default (setup script, only when no rule exists): Tuesday–Sunday, hourly 10:00–18:00
(8 windows per day).

## BlockedDate

| Field | Type | Rules |
|---|---|---|
| id | id `blkd` | |
| date | text `YYYY-MM-DD` | |
| fulfillment_method | enum `pickup`, nullable | `null` = blocks every method (e.g. wedding) |
| reason | text, nullable | staff-only, e.g. "Wesele" |

Unique per (date, fulfillment_method).

## Booking

The capacity record and the term history of one order.

| Field | Type | Rules |
|---|---|---|
| id | id `bkg` | |
| cart_id | text | unique among `active` bookings |
| order_id | text, nullable | set by the `order.placed` subscriber |
| fulfillment_method | enum `pickup` | |
| date | text `YYYY-MM-DD` | indexed |
| start_time / end_time | text `HH:mm` | |
| status | enum `active`, `canceled` | default `active` |
| previous_date / previous_start_time / previous_end_time | text, nullable | last term before a reschedule |
| rescheduled_at | datetime, nullable | |

State transitions:

```
(validate hook, under lock) ──create──▶ active ──order.canceled──▶ canceled
          │                               │
          └─ later step fails ─▶ deleted  └─ staff reschedule ─▶ active (new term, previous_* set)
```

Capacity used on a date = count of `active` bookings with that `date` (any method).

## Term on cart / order (not a model)

`metadata.catering_term = { method, date, start, end }` — set by the storefront on the cart,
copied by Medusa to `order.metadata`, kept in sync by the reschedule workflow (contracts).

## Derived: availability

For each date in the requested range and each window rule of its weekday, a window is
available when all hold (FR-002):

1. `date` ≥ today (Warsaw) and `date` ≤ today + `booking_horizon_days`;
2. the method's schedule `is_enabled`;
3. no `BlockedDate` for (`date`, method) or (`date`, `null`);
4. window start (Warsaw → instant) − now ≥ `lead_time_hours`;
5. active bookings on `date` < `daily_capacity`.

A day is available when at least one of its windows is. Unavailable days carry the first
failing reason: `past`, `beyond_horizon`, `disabled`, `blocked`, `closed` (no windows that
weekday), `full`, `lead_time`.
