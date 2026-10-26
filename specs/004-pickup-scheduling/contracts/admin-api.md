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

- `GET /admin/catering/blocked-dates?from&to` (max 366 days) →
  `{ blocked_dates: [{ id, date, method, reason, period_id }] }` (`method: null` = all methods;
  `period_id: null` = a single day)
- `POST /admin/catering/blocked-dates` `{ date, method?: "pickup" | null, reason? }` (one day) or
  `{ from, to, method?, reason? }` (a period, inclusive, max 366 days; added 2026-10-26) →
  `{ blocked_date, blocked_dates, period_id, skipped_dates, existing_orders }`:
  - a period is stored as **one row per day** sharing `period_id` (`blkp_…`), so availability
    still checks single days; `blocked_date` is the first created day (kept for 004 clients);
  - days already blocked for the same method are skipped and listed in `skipped_dates`; an
    already-blocked single day, or a period with every day blocked, answers `422 duplicate_error`;
  - `existing_orders`: bookings (requested, confirmed, active) in the range — the UI warns when
    `> 0`; orders are not changed.
- `DELETE /admin/catering/blocked-dates/:id` → `{ id, deleted: true }` (one day, also one day of a
  period)
- `DELETE /admin/catering/blocked-periods/:period_id` → `{ period_id, deleted: <days> }` (every
  remaining day of the period)

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

`blocked` is `null` or `{ id, reason, method }` (`method: null` = whole kitchen) — the `id` is
used by the "Odblokuj" action. Includes days with bookings outside the current window rules
(window still listed). A
booking whose order is not linked yet appears with `order_id: null`.

## Reschedule — `POST /admin/catering/orders/:id/pickup-term`

Body `{ date, start, end, confirm?: boolean }`.

- All rules pass → `200 { booking }`, order metadata updated.
- A rule is broken and `confirm` is not `true` → `409`
  `{ type: "conflict", message, warnings: ["full" | "blocked" | "closed" | "lead_time" | "beyond_horizon" | "past"] }`
  — the UI asks staff to confirm and repeats the call with `confirm: true`, which saves.
- `404` when the order has no active booking.
