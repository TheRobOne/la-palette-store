# Data Model: On-Request Pickup Terms

Changes to the catering module models from
[004 data-model](../004-pickup-scheduling/data-model.md); one migration.

## WindowRule (+1 field)

| Field | Type | Rules |
|---|---|---|
| requires_confirmation | boolean | default `false`; `true` = the window is "on request" |

## FulfillmentSchedule (+3 fields, per method)

| Field | Type | Rules |
|---|---|---|
| request_lead_time_hours | number | ≥ 0; default 72; replaces `lead_time_hours` for on-request windows |
| request_response_hours | number | 1–168; default 24 |
| request_payment_hours | number | 1–168; default 24 |

## Booking (status extended, +request fields)

| Field | Type | Rules |
|---|---|---|
| status | enum | `requested`, `confirmed`, `active`, `declined`, `expired`, `canceled` (004: `active`, `canceled`) |
| requires_confirmation | boolean | default `false`; `true` for bookings created as requests |
| response_deadline | dateTime, nullable | set when sent: `min(now + request_response_hours, window start)` |
| payment_deadline | dateTime, nullable | set when confirmed: `min(now + request_payment_hours, window start)` |
| decided_at | dateTime, nullable | confirm / decline time |
| decided_by | text, nullable | Admin user id |
| request_snapshot | json, nullable | `{ items: [{ variant_id, quantity }], term }` as sent; payment requires the cart to match (FR-009a) |

Capacity used on a date = count of bookings with status in `requested`, `confirmed`, `active`
(was: `active`).

### State machine

```
standard window:   (completion, under lock) ─────────────────────────▶ active ─order.canceled─▶ canceled

on-request window: POST /store/catering/requests (under lock) ──▶ requested
                     requested ─staff confirm─▶ confirmed ─completion (paid, matches snapshot, ≤ payment_deadline)─▶ active
                     requested ─staff decline─▶ declined
                     requested ─job: now > response_deadline─▶ expired
                     confirmed ─job: now > payment_deadline─▶ canceled
                     confirmed ─staff decline─▶ declined
```

`declined`, `expired`, `canceled` are final and do not count. A cart may send a new request
after its previous one ended (a new booking row).

## Term / window availability (004 "Derived: availability", extended)

- Each window carries `requires_confirmation` from its rule.
- Rule 4 (lead time) uses `request_lead_time_hours` for on-request windows and
  `lead_time_hours` for standard ones.
- All other rules unchanged; on-request bookings count against capacity (above).
