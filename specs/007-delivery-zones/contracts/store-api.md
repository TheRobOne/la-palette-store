# Store API contract: delivery

For la-palette-garden (`src/catering`). Every call needs `x-publishable-api-key`. Amounts are
gross PLN in major units (`30` = 30 zł). Dates/times as in
[004 store-api.md](../../004-pickup-scheduling/contracts/store-api.md).

**Not breaking**: the pickup checkout keeps working unchanged. New: a quote route, a second
shipping option, `method=delivery` for slots, a window-level `reason`, delivery fields on the
order rules and the request status, new completion errors.

## 1. Order rules — `GET /store/catering/order-rules` (extended)

```json
{
  "order_rules": {
    "currency_code": "pln",
    "min_order_value": 100,
    "fulfillment": {
      "pickup": { "enabled": true, "address": { "address_1": "ul. Gustawa Morcinka 40", "postal_code": "31-762", "city": "Kraków", "phone": "+48 734 431 447" } },
      "delivery": { "enabled": true, "free_delivery_threshold": null }
    }
  }
}
```

- `delivery.enabled` is `false` when the delivery schedule is disabled — hide the option.
- `free_delivery_threshold`: number or `null` (no free delivery). Show "darmowa dostawa od X zł"
  when set.

## 2. Choosing the method

The fulfillment-method step offers "Odbiór osobisty" and "Dostawa". The method decides:

| | Pickup | Delivery |
|---|---|---|
| `catering_term.method` | `"pickup"` | `"delivery"` |
| Slots | `GET /store/catering/slots?method=pickup` | `GET /store/catering/slots?method=delivery` |
| Shipping option (`listCartOptions`) | `type.code: "pickup"` | `type.code: "delivery"` |
| `shipping_address` | leave empty | required (§3) |

Recognise options by `type.code`, never by name. Switching method: set the other option with
`addShippingMethod` (it replaces the previous one), clear `catering_term` (`""`) and let the
customer choose a window of the new method.

## 3. Delivery address

```ts
await sdk.store.cart.update(cartId, {
  shipping_address: {
    first_name: "Anna",
    last_name: "Nowak",
    address_1: "ul. Przykładowa 5/2",
    postal_code: "31-870",
    city: "Kraków",
    phone: "+48 600 000 000",
    country_code: "pl",
  },
})
```

- Required for delivery: `address_1`, `postal_code`, `city`, `phone` (the driver calls it).
- `postal_code` MUST be a full code `XX-XXX` (validate in the form; no partial codes). Anything
  else is not priced and completion is refused.
- Medusa re-prices the delivery shipping method on every cart update (address or items); read
  the amount from `cart.shipping_total` / `cart.shipping_methods[0].amount` after the update.
- "Dostawa" is a **calculated** option: `listCartOptions` returns it without `amount`. Before it
  is added, read its price with `sdk.store.fulfillment.calculate(optionId, { cart_id })`
  (`POST /store/shipping-options/:id/calculate`, needs the cart's postal code), or show the
  quote (§4).
- Do not put invoice data here (`billing_address`, unchanged).

## 4. Delivery quote — `GET /store/catering/delivery-quote`

Use it as soon as the customer has typed a full, valid postal code — before the rest of the
address is complete — and to render the out-of-zone message.

| Query | Required | Notes |
|---|---|---|
| `postal_code` | yes | `XX-XXX`; validate on the storefront first |
| `cart_id` | no | with a cart the amount accounts for the free-delivery threshold and a staff-confirmed cost |

`200`:

```json
{ "delivery_quote": { "postal_code": "31-870", "status": "in_zone", "zone": { "id": "dzone_…", "name": "Strefa 1" }, "amount": 30, "min_order_value": 100, "free_delivery_threshold": null, "requires_confirmation": false } }
```

```json
{ "delivery_quote": { "postal_code": "34-500", "status": "out_of_zone", "zone": null, "amount": null, "min_order_value": 100, "free_delivery_threshold": null, "requires_confirmation": true } }
```

```json
{ "delivery_quote": { "postal_code": "31870", "status": "invalid", "zone": null, "amount": null, "min_order_value": 100, "free_delivery_threshold": null, "requires_confirmation": false } }
```

- `in_zone`: show "Dostawa: 30,00 zł" in the cart; `amount: 0` above the threshold →
  "Dostawa gratis". `min_order_value` is the effective minimum (higher of global and zone).
- `out_of_zone`: before anything is sent, show that delivery to this address needs the
  kitchen's confirmation, the cost is given with it and payment happens only afterwards. Use
  the request path (§6) for **any** window. `amount` becomes a number once staff have confirmed
  (with `cart_id`).
- `invalid`: should not happen with form validation; ask for a correct postal code
  (`XX-XXX`); no price.
- Uncached (`cache: "no-store"`); zones change in the Admin without a deploy.
- An unknown `cart_id` answers 404.

## 5. Slots for delivery

`GET /store/catering/slots?from&to&method=delivery` — same shape as 004. New per window:

```json
{ "start": "12:00", "end": "14:00", "available": false, "requires_confirmation": false, "reason": "window_full" }
```

- `reason` (window level, new, also for pickup): `null` when available, otherwise `full` (day
  capacity), `window_full` (delivery maximum for this window reached), `lead_time`.
- Day-level `reason` is unchanged.

## 6. Out-of-zone request (extends 005)

- Send exactly as an on-request term: `POST /store/catering/requests { cart_id }` — accepted for
  an out-of-zone delivery cart on any window; refused for an in-zone cart on a standard window
  (unchanged FR-003a).
- `GET /store/catering/requests/:cart_id` gains:

```json
{ "request": { "status": "confirmed", "fulfillment": { "method": "delivery", "postal_code": "34-500", "out_of_zone": true, "delivery_cost": 80 }, "…": "005 fields" } }
```

  `delivery_cost` is `null` until staff confirm. After confirmation the cart's delivery method is
  already re-priced to it: run the normal payment step and `complete` on the same, unchanged
  cart.
- Changing the postal code after sending makes the request unpayable (005 snapshot rule),
  unless the new code is in a zone on a standard window: then the cart is paid normally at the
  zone price and the request is canceled.
- The agreed `delivery_cost` stays for its postal code even if that code is later added to a
  zone (the quote stays `out_of_zone` with that amount).

## 7. Completion errors (new, 400 `invalid_data`, Polish, show as is)

Checked in the existing order after the term check:

| Situation | `message` |
|---|---|
| Delivery without address/phone | `Uzupełnij adres dostawy: <missing fields>.` |
| Invalid postal code | `Podaj poprawny kod pocztowy (XX-XXX).` |
| Method and shipping option differ | `Wybierz ponownie sposób odbioru lub dostawy.` |
| Delivery amount differs from the quote (zone or price changed) | `Koszt dostawy się zmienił — sprawdź koszyk i spróbuj ponownie.` |
| Below the zone minimum | `Minimalna wartość zamówienia z dostawą pod ten adres to <X>. Dodaj produkty za co najmniej <Y>.` |
| Out of zone without a confirmed request | `Dostawa pod ten adres wymaga potwierdzenia kuchni — wyślij zapytanie.` |
| Window full for deliveries | existing `Wybrany termin … nie jest już dostępny. Wybierz inny termin.` (wording "dostawy" for delivery) |

The term errors use "termin dostawy" instead of "termin odbioru" for delivery carts.
