# Research: Transactional E-mails

Medusa findings verified against the installed **2.21.1** source in `node_modules/.pnpm`
(latest on the registry 2026-10-26: 2.22.1, same major — no upgrade in this feature).

## R-01 Sending through the Medusa Notification Module

- **Decision**: use the core Notification Module (`@medusajs/medusa/notification`, a default
  module) with one custom provider module `resend` (channel `email`), configured in
  `medusa-config.ts`; every e-mail is `notificationModule.createNotifications({ to, channel:
  "email", template, data, resource_id, resource_type, trigger_type, idempotency_key })`.
- **Rationale**: the module already stores each notification (`notification` table: `to`,
  `template`, `data`, `resource_id`, `resource_type`, `trigger_type`, `idempotency_key`
  **unique**, `external_id`, `status` `pending|success|failure`) — that is FR-007 (once), FR-008
  (outcome) and FR-009 (history) without a model of our own. Verified in
  `notification/dist/services/notification-module-service.js` `createNotifications_`: entries
  whose `idempotency_key` already exists are skipped unless the existing one has
  `status = failure`.
- **Alternatives**: calling Resend directly from subscribers (no history, own dedupe table —
  more code); Medusa's SendGrid provider (another vendor, user chose Resend).

## R-02 Resend provider

- **Decision**: `src/modules/resend/` — a module provider extending
  `AbstractNotificationProviderService` (`static identifier = "resend"`), options
  `{ api_key, from, reply_to }`, `send()` renders the template (R-04) and calls the `resend`
  SDK (`emails.send({ from, to, reply_to, subject, html, text })`), returning `{ id }`
  (stored as `external_id`). A Resend error is thrown → the module marks the notification
  `failure`.
- **Dependency**: `resend` **6.34.1** (registry latest 2026-10-26, Node ≥ 20). Its peer
  `@react-email/render` is only needed for React templates — not used.
- **Rationale**: Medusa's documented way to add an e-mail service; one small file.
- **Alternatives**: SMTP via nodemailer to Resend (needs a second dependency and gives no
  message id).

## R-03 Environments and the allow-list (FR-013)

- **Decision**: the provider sends only when `APP_ENV = production` **or** the recipient is in
  `NOTIFICATION_ALLOWLIST` (comma-separated addresses/domains); otherwise it logs
  `[e-mail suppressed] <template> → <to>` and returns `{ id: "suppressed" }`. Without
  `RESEND_API_KEY` it logs only (local development, CI, integration tests).
- **Rationale**: staging is used by the team through the Vercel preview — real customer
  addresses must never receive staging e-mails; the team still sees real e-mails.
- **Note**: today there is no production environment (README "Environments"); staging gets
  `RESEND_API_KEY` + an allow-list.

## R-04 Templates

- **Decision**: plain TypeScript functions per template in `src/lib/emails/templates/*.ts`
  returning `{ subject, html, text }` from typed data, sharing one layout (logo, colours from
  la-palette-garden `globals.css`: `#faf7f2` background, `#3f3232` text, `#6f5141` buttons;
  logo `https://www.lapalettegarden.pl/logo-full-kolor.png`), table-based HTML with inline
  styles, every value HTML-escaped.
- **Rationale**: 11 short Polish templates; no React renderer or build step (constitution VII).
  E-mail clients need inline styles, so the brand values are copied from the site tokens —
  justified in plan Complexity Tracking (constitution III).
- **Alternatives**: React Email (`@react-email/components` + render): nicer authoring, +2
  dependencies and JSX in the backend — rejected for now.

## R-05 Triggers

| Template | Trigger | Idempotency key |
|---|---|---|
| `order-confirmation` (customer) | subscriber `order.placed` | `order-confirmation:<order_id>` |
| `staff-new-order` | subscriber `order.placed` | `staff-new-order:<order_id>` |
| `request-created` (customer) | `catering.request.created` (005) | `request-created:<booking_id>` |
| `staff-new-request` | `catering.request.created` | `staff-new-request:<booking_id>` |
| `request-confirmed` | `catering.request.confirmed` | `request-confirmed:<booking_id>` |
| `request-declined` | `catering.request.declined` | `request-declined:<booking_id>` |
| `request-expired` | `catering.request.expired` | `request-expired:<booking_id>` |
| `request-canceled` | `catering.request.canceled` | `request-canceled:<booking_id>` |
| `pickup-rescheduled` | new event `catering.pickup.rescheduled` | `pickup-rescheduled:<booking_id>:<rescheduled_at>` |
| `order-canceled` | subscriber `order.canceled` | `order-canceled:<order_id>` |
| `staff-request-reminder` | job (R-06) | `staff-request-reminder:<booking_id>` |
| `pickup-reminder` | job (R-06) | `pickup-reminder:<order_id>:<pickup date>` |

- `order.placed` covers shop orders and paid on-request requests (they become orders through
  the same completion). A paid request gets no extra request e-mail (US2 scenario 4).
- `catering.pickup.rescheduled` is emitted by `reschedule-order-pickup.ts` with
  `{ id, cart_id, order_id, previous: { date, start, end } }`; the key includes
  `rescheduled_at`, so each move sends one e-mail.
- Draft orders converted in the Admin also emit `order.placed` — to verify in T001 (spec edge
  case); if not, out of scope and noted.

## R-06 Scheduled jobs

- **Staff reminder** — `src/jobs/remind-staff-requests.ts`, `*/15 * * * *`: bookings
  `requested` with `response_deadline` in `(now, now + staff_reminder_hours]`; key per booking.
- **Pickup reminder** — `src/jobs/send-pickup-reminders.ts`, hourly `5 * * * *`: when the
  Warsaw time is ≥ 08:00, active bookings with an order for **tomorrow** (Warsaw date) whose
  order was placed ≥ 24 h before the window start; key per order and date (a reschedule to a
  later day sends a reminder for the new date only, a cancelled order has no active booking).
  Hourly with a key instead of one 08:00 run: survives restarts and DST without cron time zones.
- **Retry** — `src/jobs/retry-failed-notifications.ts`, `*/15 * * * *`: notifications
  `failure` created in the last 24 h → resend through the same key, at most 5 attempts
  (attempt count in `data._attempts`).
- ⚠ **To verify in T001**: on a resend of a failed key, `createNotifications_` builds the entry
  with a **new** `id` and only updates rows by id — the existing `failure` row may stay
  `failure` (or the update may fail). Fallback if confirmed: the retry job sends through the
  provider and updates the existing row itself (`updateNotifications`).

## R-07 Data for the e-mails

- Order: `query.graph` `order` with `display_id`, `email`, `items.{title,variant_title,quantity,
  unit_price,total}`, `item_total`, `total`, `currency_code`, `metadata` (`catering_term`,
  `invoice_*`, `order_notes`), `billing_address.*` (contact name/phone and invoice company
  data — la-palette-garden checkout stores contact in `billing_address`).
- Request: booking + `query.graph` `cart` (same fields) — no order exists yet.
- Pickup address: `loadOrderRules().fulfillment.pickup.address` (existing contract).
- Links: `STOREFRONT_URL` (new env, e.g. `https://lapalettegarden.pl`) + `/catering/zapytanie/
  <cart_id>` (status and payment, 005), `/catering/regulamin`; staff links
  `MEDUSA_BACKEND_URL/app/orders/<id>` and `/app/pickup-requests`.
- Customer e-mails carry the order's own data only; the status page shows no personal data
  (005) — the e-mail is the durable copy (FR-001, FR-012).

## R-08 Notification settings (FR-004, FR-010)

- **Decision**: store metadata like the minimum order value (`catering_min_order_value`):
  `catering_staff_email` (address, empty = staff e-mails skipped and logged) and
  `catering_staff_reminder_hours` (default 4, 1–24), edited in an Admin widget on
  Settings → Store next to the minimum order value; `src/lib/notification-settings.ts` reads
  them with defaults.
- **Alternatives**: a settings model in the catering module (a migration for two values);
  env variables (need a deploy — FR-010).

## R-09 Admin history (FR-009)

- `GET /admin/catering/notifications?resource_id=<order_id|booking_id>` →
  notifications (template, to, status, created_at) — shown by a widget on the order page
  (`order.details.side.after`) and in each row of "Zapytania".
- Requests and their later order: e-mails before payment use `resource_type: "pickup_request"`
  (booking id), after payment `resource_type: "order"`; the order widget also lists the
  request e-mails through the order's booking.

## R-10 DNS and sender (external dependency)

- Resend domain `lapalettegarden.pl` (or subdomain `mail.lapalettegarden.pl` to keep the
  website's mail untouched): SPF/DKIM records from the Resend dashboard, DMARC `p=none` to
  start. Sender `La Palette Garden <zamowienia@lapalettegarden.pl>`, reply-to the kitchen's
  contact address. Needs the domain owner; blocks sending, not development.

## R-11 Verification (T001, 2026-10-26)

- (a) Resend of a failed key: `createNotifications_` gives the entry a **new** `id`
  (`{ id: generateEntityId(...), ...entry }`), creates nothing for an existing key and then
  updates by that new id — the existing `failure` row is not the one updated. **Decision**: the
  retry job does not go through `createNotifications`; it calls the provider's delivery
  function (`deliverEmail`, shared with `send()`) and updates the existing row with
  `updateNotifications({ id, status, external_id, data })`.
- (b) The Notification Module is a default module (`@medusajs/medusa/notification`); its loader
  reads `options.providers[]` and matches channels from each provider's `options.channels`.
  Without an `email` provider it would register the Medusa Cloud provider only when cloud
  options are set — so the `resend` provider is always registered (it logs when no API key).
- (c) `convertDraftOrderWorkflow` emits `order.placed` (`core-flows/dist/draft-order/workflows/
  convert-draft-order.js`) — Admin orders get the same e-mails.
- (d) `cancelOrderWorkflow` emits `order.canceled` with `{ id: order.id }`.
