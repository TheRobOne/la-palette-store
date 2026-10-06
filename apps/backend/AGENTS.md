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
      "delivery": { "enabled": false }
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

### Fulfillment — in-person pickup only

Pickup at the venue is the only option at launch (delivery zones deferred). Setup is idempotent
in `src/scripts/setup-pickup.ts` (run by `seed.ts` on every deploy; names in `src/lib/pickup.ts`
are lookup keys — don't rename them in the Admin).

1. `sdk.store.fulfillment.listCartOptions({ cart_id })` → one option, `name: "Odbiór osobisty"`,
   `amount: 0`, `type.code: "pickup"`. Recognise pickup by `type.code`, not by name.
2. `sdk.store.cart.addShippingMethod(cartId, { option_id })`.
3. **Do not fill `shipping_address`.** Medusa 2.21.1 (verified in core-flows source and the
   integration test) needs no street address to list pickup options or complete the cart. On cart
   creation it pre-fills only `country_code: "pl"` (single-country region), which the pickup zone's
   PL geo zone matches; the order keeps that address with all other fields `null`. The pickup
   address comes from `order_rules.fulfillment.pickup.address`. `billing_address` stays free for
   invoice data.

### Optional company invoice

The customer may tick "chcę fakturę" and give NIP, company name and company address. Set it on the
cart before completion with one call; both parts are copied to the order by Medusa
(`cart.metadata` → `order.metadata`, `cart.billing_address` → `order.billing_address`):

```ts
await sdk.store.cart.update(cartId, {
  // Send the whole metadata object (spread the current cart.metadata) so other keys survive.
  metadata: { ...cart.metadata, invoice_requested: true, invoice_nip: "123-456-32-18" },
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

### Cart completion errors — `POST /store/carts/:id/complete`

Order rules are checked in the single `completeCartWorkflow.hooks.validate` handler
(`src/workflows/hooks/complete-cart-validate.ts` — a hook takes only one handler, so add future
rules such as pickup slots there). A rejected cart answers **400**:

```json
{ "type": "invalid_data", "message": "Minimalna wartość zamówienia to 100,00 zł. Dodaj produkty za co najmniej 88,00 zł." }
```

`message` is Polish and customer-readable — show it as is. Payment errors keep Medusa's default
(200 with `type: "cart"` and `error`).
