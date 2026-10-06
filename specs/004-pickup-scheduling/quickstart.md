# Quickstart: Pickup Scheduling

Validation guide. Contracts: [store-api.md](contracts/store-api.md),
[admin-api.md](contracts/admin-api.md); entities: [data-model.md](data-model.md).

## Prerequisites

- `apps/backend/.env` pointing at the Railway **dev** database (never staging).
- Migrations and seed: `cd apps/backend && pnpm exec medusa db:migrate && pnpm run seed` — the
  seed creates the default schedule (Tue–Sun, hourly 10:00–18:00, 48 h, 60 days, capacity 10)
  only if none exists.
- Publishable key: printed by the seed ("Storefront publishable key").

## Automated checks

```bash
cd apps/backend
pnpm run lint && pnpm run typecheck
pnpm run test:unit                       # availability, time zone/DST, term validation
pnpm run test:integration:http -- integration-tests/http/pickup-scheduling.spec.ts
```

Expected integration results:

| Scenario | Expected |
|---|---|
| `GET /store/catering/slots` for 14 days | every date present; Mondays `closed`; dates inside 48 h `lead_time` |
| range > 62 days | 400 `invalid_data` |
| complete without `catering_term` | 400 `Wybierz termin odbioru.` |
| complete for a blocked date | 400 "…nie jest już dostępny…" |
| capacity 1, two carts complete concurrently (`Promise.all`) | exactly one `type: "order"`, one 400 |
| order then cancel | day available again |
| valid term | order placed, `order.metadata.catering_term` equals the cart's |
| existing pickup/min-order/invoice tests | still pass |

## Manual check (Admin, `pnpm run dev`, http://localhost:9000/app)

1. Settings → "Harmonogram odbiorów": change Saturday windows, capacity, lead time; reload
   `GET /store/catering/slots` — changes visible within a minute (SC-002).
2. Block a date with reason "Wesele" on a day with an order → warning with the order count;
   the date disappears from the Store slots.
3. Sidebar "Odbiory": upcoming days with orders per window, used/total, blocked marker (SC-005).
4. Open an order → widget "Termin odbioru"; move it to a full day → warning, confirm → order
   and calendar show the new term and the previous one.

## DST spot check

`GET /store/catering/slots?from=2026-10-24&to=2026-10-26` with the clock set before
2026-10-22: Sunday 2026-10-25 lists the same windows as any other Sunday (no shifted or
duplicated hours). Covered by unit tests for 2026-03-29 and 2026-10-25.
