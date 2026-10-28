# apps/backend AGENTS.md

Backend-specific notes. The root [AGENTS.md](../../AGENTS.md) still applies.

## Storefront cache revalidation

The storefront (la-palette-garden, `lapalettegarden.pl/catering`) caches catalog pages with
Next.js tags. After a catalog change the backend tells it which tags to rebuild. Full
contract: [specs/003-storefront-revalidation/contracts/revalidate.md](../../specs/003-storefront-revalidation/contracts/revalidate.md);
the endpoint itself is owned by la-palette-garden (`src/catering/AGENTS.md`).

```
POST {CATERING_REVALIDATE_URL}
x-revalidate-secret: <CATERING_REVALIDATE_SECRET>
Content-Type: application/json

{ "tags": ["products", "product:<handle>", "categories", "regions"] }
```

- Tags: `products`, `categories`, `regions`, `product:<handle>` (`^[a-z0-9-]+$`), 1–50 per call.
- Responses: 200 `{"revalidated":[...]}`, 400 bad body/tag, 401 wrong secret, 500 secret unset
  on the storefront.
- Code: `src/lib/storefront-revalidation.ts` (event → tag mapping, dedupe, 1 s batch, HTTP with
  5 s timeout) and `src/subscribers/storefront-revalidation.ts`.
- Failures are logged, never thrown. Without both env variables the call is skipped with an
  info log (normal locally).
- When you add a catalog-affecting event or a new cached Store API read on the storefront,
  update the mapping, its unit test and the contract together.
- Scripts run with `medusa exec` exit before the batch fires: call `revalidateStorefront`
  explicitly at the end of a script that changes the catalog (see `seed-catalog.ts`).

## Transactional e-mails (spec 006)

Spec: [specs/006-transactional-emails](../../specs/006-transactional-emails/) — catalogue of
templates, subjects and required content in `contracts/emails.md`; delivery wording in
[specs/007-delivery-zones/contracts/emails.md](../../specs/007-delivery-zones/contracts/emails.md)
(template data `fulfillment`; absent in older stored data = pickup).

- **Sending**: Medusa's Notification Module with our provider `src/modules/resend` (channel
  `email`, registered in `medusa-config.ts`). Every e-mail is a notification row: template, data,
  recipient, `resource_type`/`resource_id` (`order` or `pickup_request` = booking id), status.
- **Never send directly** — call `sendEmail` / `sendStaffEmail` (`src/lib/emails/send.ts`) with an
  idempotency key `<template>:<record id>`. The key makes repeated events and job runs send
  nothing new; errors are logged, never thrown into the order/request flow.
- **Triggers**: `src/subscribers/email-order-placed.ts` (`order.placed` → `order-confirmation` +
  `staff-new-order`), `src/subscribers/email-request-events.ts` (`catering.request.*`),
  `src/subscribers/email-pickup-rescheduled.ts` (`catering.pickup.rescheduled`, emitted by
  `reschedule-order-pickup.ts` for orders and requests → `pickup-rescheduled`, one per move),
  `src/subscribers/email-order-canceled.ts` (`order.canceled` → `order-canceled`),
  `src/jobs/remind-staff-requests.ts` (every 15 min), `src/jobs/send-pickup-reminders.ts` (hourly,
  from 08:00 Warsaw the day before; not for orders placed < 24 h before the window),
  `src/jobs/retry-failed-notifications.ts` (every 15 min, up to 5 attempts within 24 h; updates the
  failed row itself — research R-11).
- **Templates**: `src/lib/emails/templates/*` → `{ subject, html, text }` via the shared layout
  (`layout.ts`, inline brand colours copied from la-palette-garden `globals.css`); data from
  `src/lib/emails/data.ts`, stored on the notification so a retry renders the same e-mail.
  Adding one: renderer + entry in `templates/index.ts` + unit test + row in `contracts/emails.md`.
- **Environments**: no `RESEND_API_KEY` → only logged (`[e-mail logged] …`, local/CI/tests);
  outside `APP_ENV=production` only `NOTIFICATION_ALLOWLIST` (addresses or `@domains`) receives
  e-mails, others are logged as suppressed. Links use `STOREFRONT_URL`; sender `EMAIL_FROM`,
  replies `EMAIL_REPLY_TO`.
- **History**: `GET /admin/catering/notifications?resource_id=<ids>` (an order also lists the
  e-mails of the request it was paid from); shown by `src/admin/widgets/order-emails.tsx` on the
  order page and as "Ostatni mail do klienta" on the "Zapytania" page.
- **Sender**: `catering@lapalettegarden.pl` — an alias of the Google Workspace account, so replies
  reach the office inbox; Resend's DNS records live only on `send.` and `resend._domainkey`
  (research R-10 — never touch the root MX/SPF).
- **Staff settings**: Admin → Settings → Store widget (`src/admin/widgets/notification-settings.tsx`)
  — store metadata `catering_staff_email` (empty = no staff e-mails) and
  `catering_staff_reminder_hours` (1–24, default 4).

## Kontrakty dla storefrontu

API contracts for la-palette-garden (`src/catering`) that have no Spec Kit spec of their own.
Every call needs `x-publishable-api-key`. Amounts are gross PLN in major units (`100` = 100 zł).

### Order rules — `GET /store/catering/order-rules`

```json
{
  "order_rules": {
    "currency_code": "pln",
    "min_order_value": 100,
    "fulfillment": {
      "pickup": {
        "enabled": true,
        "address": { "address_1": "ul. Gustawa Morcinka 40", "postal_code": "31-762", "city": "Kraków", "phone": "+48 734 431 447" }
      },
      "delivery": { "enabled": true, "free_delivery_threshold": null }
    }
  }
}
```

- Show `min_order_value` in the cart as soon as it has items; compare it with `cart.item_total`
  (gross items after discounts, without shipping) and block "go to checkout" below it.
- Staff change the value in Admin → Settings → Store (widget; stored in store metadata
  `catering_min_order_value`, default 100, 0 disables the limit). It is not part of the
  revalidation tags — fetch it with a short cache (≤ 60 s) or uncached.
- Code: `src/api/store/catering/order-rules/route.ts`, `src/lib/order-rules.ts`,
  `src/lib/min-order-value.ts`, `src/admin/widgets/min-order-value.tsx`.

### Fulfillment — pickup or city delivery (spec 007)

Two shipping options. Setup is idempotent in `src/scripts/setup-pickup.ts` and
`src/scripts/setup-delivery.ts` (both run by `seed.ts` on every deploy; names in
`src/lib/pickup.ts` are lookup keys — don't rename them in the Admin). **Recognise options by
`type.code` (`"pickup"` / `"delivery"`), never by name or list position.**

#### Pickup

1. `sdk.store.fulfillment.listCartOptions({ cart_id })` → `name: "Odbiór osobisty"`,
   `amount: 0`, `type.code: "pickup"`.
2. `sdk.store.cart.addShippingMethod(cartId, { option_id })`.
3. **Do not fill `shipping_address`.** Medusa 2.21.1 (verified in core-flows source and the
   integration test) needs no street address to list pickup options or complete the cart. On cart
   creation it pre-fills only `country_code: "pl"` (single-country region), which the pickup zone's
   PL geo zone matches; the order keeps that address with all other fields `null`. The pickup
   address comes from `order_rules.fulfillment.pickup.address`. `billing_address` stays free for
   invoice data.

#### Delivery

Full contract: [specs/007-delivery-zones/contracts/store-api.md](../../specs/007-delivery-zones/contracts/store-api.md).

- Zones are lists of full postal codes (`XX-XXX`) with a gross price and an optional minimum,
  managed in Admin → Settings → "Strefy dostawy" (catering module tables, not Medusa geo zones —
  research R-01). One free-delivery threshold for all zones (store metadata
  `catering_free_delivery_threshold`, widget next to the minimum order value; empty = off).
- `GET /store/catering/delivery-quote?postal_code=XX-XXX[&cart_id]` (uncached) → `status`
  `in_zone` / `out_of_zone` / `invalid`, `amount`, effective `min_order_value`.
- Option `name: "Dostawa"`, `type.code: "delivery"`, **calculated**: `listCartOptions` returns it
  without `amount`; price it with `sdk.store.fulfillment.calculate(optionId, { cart_id })`. The
  `catering-delivery` fulfillment provider returns the amount a pricing hook
  (`src/workflows/hooks/delivery-pricing-context.ts`) computes from the cart's postal code, so
  Medusa re-prices the method on every cart update.
- Fill `shipping_address` (`address_1`, `postal_code`, `city`, `phone`, `country_code: "pl"`) for
  delivery only; `catering_term.method = "delivery"` with a window from
  `/store/catering/slots?method=delivery` (own windows, lead time, blocks and a per-window
  driver limit; daily capacity shared with pickup).
- Out of zone → the on-request path below on any window; staff confirm with a delivery cost and
  the cart is re-priced to it before payment.

### Optional company invoice

The customer may tick "chcę fakturę" and give NIP, company name and company address. Set it on the
cart before completion with one call; both parts are copied to the order by Medusa
(`cart.metadata` → `order.metadata`, `cart.billing_address` → `order.billing_address`):

```ts
await sdk.store.cart.update(cartId, {
  // Medusa merges cart metadata shallowly: other keys (e.g. catering_term) survive.
  metadata: { invoice_requested: true, invoice_nip: "123-456-32-18" },
  billing_address: {
    company: "Firma Sp. z o.o.",        // required with an invoice
    address_1: "ul. Testowa 1",         // required
    postal_code: "30-001",              // required
    city: "Kraków",                     // required
    country_code: "pl",
  },
})
```

- `invoice_requested` must be the boolean `true`; `false` or a missing key means no invoice and the
  other fields are ignored. Unticking: send `invoice_requested: false`.
- `invoice_nip` accepts digits with optional spaces, dashes, dots and a `PL` prefix; the backend
  checks length and checksum. The storefront should run the same check for early feedback
  (algorithm in `src/lib/nip.ts`: weights 6,5,7,2,3,4,5,6,7, sum mod 11 = 10th digit).
- Do not put company data into `shipping_address` (pickup — see above).
- Staff see "Faktura: Tak/Nie", company, NIP and address in the order sidebar
  (`src/admin/widgets/order-invoice.tsx`).
- Validation on completion (`src/lib/invoice.ts`), 400 `invalid_data` messages:
  `Podany NIP jest nieprawidłowy. Sprawdź numer i spróbuj ponownie.` or
  `Uzupełnij dane do faktury: <missing fields>.`

### Pickup term (date + window) — spec 004

Full contract: [specs/004-pickup-scheduling/contracts/store-api.md](../../specs/004-pickup-scheduling/contracts/store-api.md).

- `GET /store/catering/slots?from=YYYY-MM-DD&to=YYYY-MM-DD[&method=pickup|delivery]` (≤ 62 days,
  uncached) → every date with `available`, `reason` and its windows (each with `reason`: `null`,
  `full`, `window_full` — delivery limit reached — or `lead_time`).
- The chosen window goes to `cart.metadata.catering_term = { method: "pickup", date, start, end }`
  (copied from a returned window). Nothing is reserved until completion.
- Completion re-checks the term and takes a place in the kitchen's daily capacity under a per-date
  lock; the order keeps `metadata.catering_term` (updated if staff reschedule).

Cart metadata is merged **shallowly** by Medusa (`mergeMetadata`): top-level keys from different
features coexist; a nested object such as `catering_term` is replaced as a whole; `""` removes a key.

### On-request terms (request → staff confirm → pay) — spec 005

Full contract: [specs/005-on-request-terms/contracts/store-api.md](../../specs/005-on-request-terms/contracts/store-api.md).

- Slot windows carry `requires_confirmation`. For such a window the shop sends a **request**
  instead of paying: `POST /store/catering/requests { cart_id }` (no payment collection). The
  backend refuses the other path both ways (FR-003a).
- The cart stays a cart; the request is a booking in state `requested` that holds capacity.
  Status for the customer: `GET /store/catering/requests/:cart_id` (`requested`, `confirmed`,
  `active` + `order_id`, `declined`, `expired`, `canceled`) — uncached.
- After staff confirm, the customer pays **the same, unchanged cart** with the normal checkout
  payment step and `complete`; only then is a Medusa order created.
- Expiry: `src/jobs/expire-pickup-requests.ts` every 5 min; payment re-checks deadlines anyway.
- Staff: Admin "Zapytania" page, calendar badges, settings toggles; Admin API in
  `specs/005-on-request-terms/contracts/admin-api.md`.
- Events `catering.request.created|confirmed|declined|expired|canceled` drive the customer and staff e-mails (spec 006, "Transactional e-mails" below).

### Cart completion errors — `POST /store/carts/:id/complete`

Order rules are checked in the single `completeCartWorkflow.hooks.validate` handler
(`src/workflows/hooks/complete-cart-validate.ts` — a hook takes only one handler, so add every
future rule there), in this order: minimum order value → invoice data → term → method and, for
delivery, address, postal code, zone minimum, delivery amount → (on-request window or out-of-zone
delivery) confirmed request / payment deadline / cart unchanged since the request. The term step
books the place (`src/lib/pickup-booking.ts`, lock key `catering:capacity:<date>`, also used by
staff reschedules) and its compensation removes the booking if a later step fails. A rejected cart
answers **400**:

```json
{ "type": "invalid_data", "message": "Minimalna wartość zamówienia to 100,00 zł. Dodaj produkty za co najmniej 88,00 zł." }
```

On-request errors: `Ten termin wymaga potwierdzenia kuchni — wyślij zapytanie.`,
`Czas na płatność za to zamówienie minął.`, `Zamówienie różni się od wysłanego zapytania — skontaktuj się z nami.`

Term errors: `Wybierz termin odbioru.`, `Wybrany termin odbioru (20.10.2026, 11:00–12:00) nie jest
już dostępny. Wybierz inny termin.`, `Nie udało się zarezerwować terminu. Spróbuj ponownie za chwilę.`
(delivery carts: "termin dostawy").

Delivery errors (spec 007 §7): `Uzupełnij adres dostawy: <missing fields>.`,
`Podaj poprawny kod pocztowy (XX-XXX).`, `Wybierz ponownie sposób odbioru lub dostawy.`,
`Koszt dostawy się zmienił — sprawdź koszyk i spróbuj ponownie.`,
`Minimalna wartość zamówienia z dostawą pod ten adres to <X>. Dodaj produkty za co najmniej <Y>.`,
`Dostawa pod ten adres wymaga potwierdzenia kuchni — wyślij zapytanie.`

`message` is Polish and customer-readable — show it as is. Payment errors keep Medusa's default
(200 with `type: "cart"` and `error`).
