# Admin API contract: pickup scheduling

Internal routes used by the Admin UI extensions of this repo (session-authenticated Admin
user). Same date/time conventions as [store-api.md](store-api.md). Errors use Medusa's
`{ type, message }` shape.

## Schedule — `GET` / `POST /admin/catering/schedule?method=pickup`

```json
{
  "schedule": {
    "method": "pickup",
    "is_enabled": true,
    "lead_time_hours": 48,
    "booking_horizon_days": 60,
    "daily_capacity": 10,
    "windows": [{ "weekday": 2, "start": "10:00", "end": "11:00" }]
  }
}
```

`POST` takes the same object (without `method`) and replaces the method's window list as a
whole. `400` on overlapping/invalid windows or out-of-range numbers. `daily_capacity` is
kitchen-wide (shared by all methods).

## Blocked dates

- `GET /admin/catering/blocked-dates?from&to` → `{ blocked_dates: [{ id, date, method, reason }] }`
  (`method: null` = all methods)
- `POST /admin/catering/blocked-dates` `{ date, method?: "pickup" | null, reason? }` →
  `{ blocked_date, existing_orders: <number of active bookings on that date> }` — the UI shows
  the warning when `existing_orders > 0`; orders are not changed.
- `DELETE /admin/catering/blocked-dates/:id` → `{ id, deleted: true }`

## Calendar — `GET /admin/catering/calendar?from&to` (max 62 days)

```json
{
  "calendar": {
    "daily_capacity": 10,
    "days": [
      {
        "date": "2026-10-20",
        "blocked": null,
        "used": 3,
        "windows": [
          {
            "start": "11:00", "end": "12:00",
            "orders": [{ "order_id": "order_…", "display_id": 1042, "email": "…", "status": "pending" }]
          }
        ]
      }
    ]
  }
}
```

Includes days with bookings outside the current window rules (window still listed). A
booking whose order is not linked yet appears with `order_id: null`.

## Reschedule — `POST /admin/catering/orders/:id/pickup-term`

Body `{ date, start, end, confirm?: boolean }`.

- All rules pass → `200 { booking }`, order metadata updated.
- A rule is broken and `confirm` is not `true` → `409`
  `{ type: "conflict", message, warnings: ["full" | "blocked" | "closed" | "lead_time" | "beyond_horizon" | "past"] }`
  — the UI asks staff to confirm and repeats the call with `confirm: true`, which saves.
- `404` when the order has no active booking.
