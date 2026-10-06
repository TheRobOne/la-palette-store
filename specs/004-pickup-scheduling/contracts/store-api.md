# Store API contract: pickup terms

For la-palette-garden (`src/catering`). Every call needs `x-publishable-api-key`. All dates
and times are Polish local time (Europe/Warsaw): dates `YYYY-MM-DD`, times `HH:mm`.
Not breaking: adds a route and a new completion rule.

## 1. Read available terms — `GET /store/catering/slots`

| Query | Required | Notes |
|---|---|---|
| `from` | yes | `YYYY-MM-DD`; earlier than today is clamped to today |
| `to` | yes | `YYYY-MM-DD`, ≥ `from`, at most 62 days after `from` |
| `method` | no | `pickup` (default; the only value today) |

`200`:

```json
{
  "slots": {
    "method": "pickup",
    "timezone": "Europe/Warsaw",
    "from": "2026-10-20",
    "to": "2026-10-26",
    "days": [
      {
        "date": "2026-10-20",
        "available": true,
        "reason": null,
        "windows": [
          { "start": "10:00", "end": "11:00", "available": false },
          { "start": "11:00", "end": "12:00", "available": true }
        ]
      },
      { "date": "2026-10-24", "available": false, "reason": "blocked", "windows": [] },
      { "date": "2026-10-26", "available": false, "reason": "closed", "windows": [] }
    ]
  }
}
```

- `days` contains every date of the range, in order.
- `reason` when `available: false`: `past`, `beyond_horizon`, `disabled`, `blocked`,
  `closed`, `full`, `lead_time`. Show a short Polish label; never show a staff block reason
  (it is not returned).
- A day with `reason: "full"` or `"lead_time"` still lists its windows, all
  `available: false`. `blocked` / `closed` / `past` / `beyond_horizon` / `disabled` days
  have `windows: []`.
- `400 invalid_data` for a missing/invalid date or a range over 62 days.
- Availability changes with every order: fetch **uncached** (`cache: "no-store"`).

## 2. Attach the chosen term to the cart

```ts
await sdk.store.cart.update(cartId, {
  metadata: {
    catering_term: { method: "pickup", date: "2026-10-20", start: "11:00", end: "12:00" },
  },
})
```

- Cart metadata is merged **shallowly** by Medusa: other top-level keys (e.g. the invoice
  keys) are kept, `catering_term` is replaced as a whole. To clear: `catering_term: ""`.
- Values MUST be copied from a window returned by §1 (`start`/`end` exactly as returned).
- Nothing is reserved at this point; the place is taken only when the order is placed.

## 3. Place the order — `POST /store/carts/:id/complete`

Checked in this order: minimum order value → invoice data → pickup term. A rejected cart
answers **400** `{ "type": "invalid_data", "message": "<Polish, show as is>" }`:

| Situation | `message` |
|---|---|
| no `catering_term` / malformed | `Wybierz termin odbioru.` |
| term no longer available (any rule: full, blocked, lead time, removed window, beyond horizon) | `Wybrany termin odbioru (20.10.2026, 11:00–12:00) nie jest już dostępny. Wybierz inny termin.` |
| capacity lock busy (rare) | `Nie udało się zarezerwować terminu. Spróbuj ponownie za chwilę.` |

On the term error, reload §1 and let the customer pick again. Two customers competing for the
last place: exactly one gets the order, the other gets the "nie jest już dostępny" error.

## 4. Term on the placed order

`order.metadata.catering_term` has the same shape as §2. If staff reschedule the order it is
updated to the new term, so the confirmation page and order history always show the current
term.
