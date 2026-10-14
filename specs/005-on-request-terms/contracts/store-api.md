# Store API contract: on-request pickup terms

For la-palette-garden (`src/catering`). Extends
[004 store-api.md](../../004-pickup-scheduling/contracts/store-api.md); **not breaking**: one
new field, two new routes, new completion messages. Every call needs
`x-publishable-api-key`; times are ISO 8601 instants, dates/times of terms as in 004.

## 1. Slots — new per-window field

`GET /store/catering/slots` (004 §1) windows gain:

```json
{ "start": "10:00", "end": "11:00", "available": true, "requires_confirmation": true }
```

- `requires_confirmation: true` → show the label "Termin na zapytanie — kuchnia musi go
  potwierdzić, płacisz dopiero po potwierdzeniu" and use the **request path** (§2) for it.
- Availability of such windows already uses the longer request lead time.

## 2. Send a request — `POST /store/catering/requests`

Body `{ "cart_id": "cart_…" }`. Preconditions: the cart is ready for checkout (items, contact
e-mail, pickup shipping method, `metadata.catering_term` on an on-request window, optional
invoice data) — **no payment collection/session needed**.

`200`:

```json
{
  "request": {
    "cart_id": "cart_…",
    "status": "requested",
    "term": { "method": "pickup", "date": "2026-10-26", "start": "10:00", "end": "11:00" },
    "response_deadline": "2026-10-15T08:30:00.000Z",
    "payment_deadline": null,
    "items": [{ "variant_id": "variant_…", "quantity": 20 }]
  }
}
```

- Idempotent: repeating it for a cart with a `requested`/`confirmed` request returns that
  request.
- `400 invalid_data` with Polish messages: same as completion (minimum order value, invoice,
  `Wybierz termin odbioru.`, `Wybrany termin odbioru (…) nie jest już dostępny…`), plus
  `Ten termin nie wymaga potwierdzenia — złóż zwykłe zamówienie.` for a standard window.
- After success, **do not modify the cart** (items, quantities, term) — payment requires it
  to match what was sent. Keep the cart cookie; show the status link (§3).

## 3. Request status — `GET /store/catering/requests/:cart_id`

Same `request` shape as §2, `status` one of:

| status | Show the customer |
|---|---|
| `requested` | "Czekamy na potwierdzenie kuchni do {response_deadline}." |
| `confirmed` | "Kuchnia potwierdziła — zapłać do {payment_deadline}." + pay button (§4) |
| `active` | "Zamówienie opłacone" + `order_id` (field present) |
| `declined` | "Kuchnia nie może przyjąć zamówienia na ten termin." |
| `expired` | "Kuchnia nie odpowiedziała na czas — zapytanie wygasło." |
| `canceled` | "Zamówienie anulowane — nie opłacono go na czas." |

`404` when the cart has no request. Fetch uncached. The status link (e.g.
`/catering/zapytanie/{cart_id}`) is the customer's only channel until e-mails exist; show it
prominently after sending.

## 4. Pay after confirmation

The normal 004 checkout payment step on **the same cart**: create the payment collection and
session, then `POST /store/carts/:id/complete`. Completion of a cart whose term window
requires confirmation answers **400 invalid_data**:

| Situation | `message` |
|---|---|
| no request sent / not confirmed yet | `Ten termin wymaga potwierdzenia kuchni — wyślij zapytanie.` |
| payment deadline passed / request ended | `Czas na płatność za to zamówienie minął.` |
| cart changed since the request | `Zamówienie różni się od wysłanego zapytania — skontaktuj się z nami.` |

On success it returns `type: "order"` as usual; §3 then shows `active` with `order_id`.
