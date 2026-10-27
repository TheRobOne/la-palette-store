# Admin API contract: transactional e-mails

Session-auth Admin user; `{ type, message }` errors.

## E-mail history — `GET /admin/catering/notifications?resource_id=<id>`

`resource_id` = an order id or a request (booking) id; for an order the response also includes
the e-mails of the request it was paid from.

```json
{
  "notifications": [
    {
      "id": "noti_…",
      "template": "request-confirmed",
      "to": "klient@example.com",
      "status": "success",
      "created_at": "2026-10-26T10:00:00.000Z",
      "attempts": 1
    }
  ]
}
```

`status`: `pending`, `success`, `failure`. Newest first.

## Notification settings

Stored in store metadata, edited through the existing store update
(`POST /admin/stores/:id` with `metadata`), like `catering_min_order_value`:

- `catering_staff_email`: string (valid e-mail) or `""` to switch staff e-mails off;
- `catering_staff_reminder_hours`: integer 1–24 (default 4).

The Admin widget validates both before saving.

No Store API changes: customers reach existing pages (`/catering/zapytanie/<cart_id>`,
`/catering/regulamin`) from the e-mails.
