# Quickstart: Transactional E-mails

## Prerequisites

- Backend on this branch, migrations and seed run (`pnpm bootstrap` / `pnpm dev`).
- Local: no `RESEND_API_KEY` → every e-mail is logged as `[e-mail …] <template> → <to>` with its
  subject; that is enough for V1–V6.
- Real sending (V7): a Resend API key in `apps/backend/.env`, `NOTIFICATION_ALLOWLIST` set to
  your own address, and the sender domain verified in Resend (research R-10).
- Integration tests: local PostgreSQL (README "Integration tests"):
  `pnpm run test:integration:http -- integration-tests/http/notifications.spec.ts`.

## Validation scenarios

- **V1 Order confirmation (US1)**: set the staff address in Admin → Settings → Store; complete a
  standard order → log shows `order-confirmation → <customer>` and `staff-new-order → <staff>`;
  Admin order page widget "E-maile" lists both as `success`.
- **V2 Request flow (US2, US3)**: mark a window on request, send a request → `request-created` +
  `staff-new-request`; confirm in "Zapytania" → `request-confirmed` with the payment link; pay
  → `order-confirmation` + `staff-new-order` and no further request e-mail.
- **V3 Decline / expiry**: decline one request → `request-declined`; set another's deadline in
  the past and run the expiry job → `request-expired`; confirm one and pass its payment
  deadline → `request-canceled`.
- **V4 Staff reminder**: a request with a response deadline in 3 h, reminder hours 4 → run
  `remind-staff-requests` → one `staff-request-reminder`; run again → nothing.
- **V5 Reschedule / cancel (US4)**: move an order's term in the Admin → `pickup-rescheduled`
  with old and new term; cancel an order → `order-canceled`.
- **V6 Pickup reminder (US5)**: an order for tomorrow placed > 24 h earlier (adjust
  `created_at` in the test) → run `send-pickup-reminders` after 08:00 Warsaw → one
  `pickup-reminder`; second run → nothing.
- **V7 Delivery**: with a real key, send V1 to Gmail, Outlook and WP test inboxes → arrives in
  the inbox, renders on a phone, plain-text part present (SC-006).
- **V8 Failure**: invalid `RESEND_API_KEY` → order still completes; notification `failure`;
  fix the key, run `retry-failed-notifications` → `success`.

Contracts: [contracts/emails.md](contracts/emails.md), [contracts/admin-api.md](contracts/admin-api.md).
