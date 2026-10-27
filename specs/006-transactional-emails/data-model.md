# Data Model: Transactional E-mails

No new tables. E-mails are records of Medusa's Notification Module; settings live in store
metadata.

## Notification (core Notification Module, existing)

| Field | Use in this feature |
|---|---|
| `to` | recipient address (customer or staff) |
| `channel` | `email` |
| `template` | one of the templates in [contracts/emails.md](contracts/emails.md) |
| `data` | template data snapshot (term, items, totals, links) + `_attempts` for retries |
| `resource_type` / `resource_id` | `order` + order id, or `pickup_request` + booking id |
| `trigger_type` | event name or job name (`order.placed`, `catering.request.confirmed`, `send-pickup-reminders`, …) |
| `idempotency_key` | unique, per template/record/recipient — see research R-05 |
| `external_id` | Resend message id (`suppressed` when not sent outside production) |
| `status` | `pending` → `success` / `failure` (set by the module) |

Rules:

- One notification per (template, record, recipient) — the key; staff e-mails use the staff
  address at sending time.
- `failure` is retried by the retry job up to 5 attempts within 24 h (R-06); after that it stays
  `failure` and is visible in the Admin.

## Store metadata (existing `store.metadata`, new keys)

| Key | Type | Rules |
|---|---|---|
| `catering_staff_email` | string | e-mail address; empty/missing = no staff e-mails (logged) |
| `catering_staff_reminder_hours` | number | 1–24; default 4 — hours before a request's response deadline |

## Event (new): `catering.pickup.rescheduled`

Emitted by `reschedule-order-pickup.ts` after a successful reschedule of an order or a request:
`{ id: booking_id, cart_id, order_id | null, previous: { date, start, end } }`.

## Environment variables (new)

| Variable | Where | Purpose |
|---|---|---|
| `RESEND_API_KEY` | staging, production | without it e-mails are only logged |
| `EMAIL_FROM` | all | e.g. `La Palette Garden <zamowienia@lapalettegarden.pl>` |
| `EMAIL_REPLY_TO` | all | kitchen contact address |
| `STOREFRONT_URL` | all | e.g. `https://lapalettegarden.pl` — base of customer links |
| `NOTIFICATION_ALLOWLIST` | non-production | comma-separated addresses or `@domain`s that may receive e-mails |
