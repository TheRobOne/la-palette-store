# Quickstart: On-Request Pickup Terms

Contracts: [store-api.md](contracts/store-api.md), [admin-api.md](contracts/admin-api.md);
model: [data-model.md](data-model.md).

## Prerequisites

- 004 in place (migrated + seeded dev DB). Apply this feature's migration and seed:
  `cd apps/backend && pnpm exec medusa db:migrate && pnpm run seed` — existing windows stay
  standard; the seed does not mark anything on request.

## Automated checks

```bash
cd apps/backend
pnpm run lint && pnpm run typecheck && pnpm run test:unit
pnpm run test:integration:http -- integration-tests/http/pickup-requests.spec.ts \
  integration-tests/http/pickup-scheduling.spec.ts integration-tests/http/pickup-order-rules.spec.ts
```

Expected (pickup-requests):

| Scenario | Expected |
|---|---|
| Monday windows marked on request | slots show Monday windows with `requires_confirmation: true`, inside 72 h not offered |
| send request for an on-request window (no payment) | 200 `requested`, `response_deadline` ≈ now + 24 h, Monday capacity −1 |
| send request for a standard window | 400 "nie wymaga potwierdzenia" |
| complete an on-request cart without a confirmed request | 400 "wymaga potwierdzenia kuchni" |
| confirm → pay → complete | 200 order; status `active` with `order_id` |
| decline | `declined`, capacity released, payment refused |
| response deadline passed + job run | `expired`, capacity released |
| confirmed, payment deadline passed + job run | `canceled`, capacity released |
| cart changed after request, then pay | 400 "różni się od wysłanego zapytania" |
| two carts, last place, one request + one standard completion concurrently | exactly one succeeds |
| all 004 tests | unchanged |

## Manual check (Admin, dev)

1. "Harmonogram odbiorów": mark Monday "na zapytanie", set 72 / 24 / 24 h.
2. Send a request through the API (or the storefront once la-palette-garden supports it).
3. "Zapytania": the request is listed with its deadline; Confirm → it shows the payment
   deadline; the calendar marks it as a request.
4. Decline another request → it disappears from capacity in the calendar.
