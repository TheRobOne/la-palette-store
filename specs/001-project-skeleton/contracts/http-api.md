# Contract: Backend HTTP API used or added by the skeleton

Base URL: `MEDUSA_BACKEND_URL` (local `http://localhost:9000`).
All responses carry `X-Robots-Tag: noindex, nofollow` when `ALLOW_INDEXING=false`.

## `GET /health` (Medusa built-in)

Liveness only. `200 OK` with body `OK`.

## `GET /status` (custom, FR-010)

No auth. Checks the database (no Redis in this feature).

`200 OK` — all dependencies up:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "local",
  "checks": { "database": "ok" }
}
```

`503 Service Unavailable` — any dependency down; same shape with `"status": "degraded"` and
the database check set to `"error"`.
Response time budget: < 1 s; each check times out after 500 ms.

## `GET /store/products` (Medusa built-in, used by storefront)

Headers: `x-publishable-api-key: <STOREFRONT_PUBLISHABLE_KEY>`.

Query used by storefront home page:

```
fields=id,title,handle,thumbnail,*variants.calculated_price,+catering_info.*
region_id=<Polska region id>
limit=24
```

Contract guarantees relied upon (per product):

| Field | Guarantee |
|---|---|
| `title`, `handle`, `thumbnail` | present for every seeded product |
| `variants[0].calculated_price.calculated_amount` | gross PLN amount (tax-inclusive) |
| `variants[0].calculated_price.currency_code` | `"pln"` |
| `catering_info.min_quantity`, `pricing_unit`, `allergens[]`, `ingredients` | present (see [data-model.md](../data-model.md)) |

## `GET /store/regions` (Medusa built-in)

Storefront resolves the "Polska" region (currency `pln`) once and caches it.

## Admin

Medusa Admin served at `MEDUSA_BACKEND_URL/app`. No custom admin routes in this feature;
`src/admin/` contains only an empty extension placeholder (FR-014).
