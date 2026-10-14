# Admin API contract: on-request pickup terms

Extends [004 admin-api.md](../../004-pickup-scheduling/contracts/admin-api.md). Session-auth
Admin user; `{ type, message }` errors.

## Schedule (004) — extended

`GET/POST /admin/catering/schedule?method=pickup` gains:

```json
{
  "request_lead_time_hours": 72,
  "request_response_hours": 24,
  "request_payment_hours": 24,
  "windows": [{ "weekday": 1, "start": "10:00", "end": "11:00", "requires_confirmation": true }]
}
```

`requires_confirmation` defaults to `false` when omitted (backwards compatible). Ranges:
lead time ≥ 0, response/payment 1–168 hours.

## Requests

- `GET /admin/catering/requests?status=requested,confirmed&from&to` →
  `{ requests: [{ id, cart_id, status, term, response_deadline, payment_deadline, email,
  item_total, items: [{ title, quantity }], decided_at, order_id }] }`, sorted by the nearest
  deadline.
- `POST /admin/catering/requests/:id/confirm` → `{ request }` with `status: "confirmed"` and
  `payment_deadline`; `409 conflict` if not `requested` or past `response_deadline`.
- `POST /admin/catering/requests/:id/decline` → `{ request }` with `status: "declined"`;
  allowed from `requested` and `confirmed`; `409` otherwise.

## Calendar (004) — extended

Each order entry gains `booking_status` (`requested`, `confirmed`, `active`; the existing
`status` stays the Medusa order status, `null` for requests) and, for requests, `request_id`,
`cart_id`, `email`, `response_deadline` / `payment_deadline`; `used` counts all three
booking states.
