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
fields=id,title,handle,thumbnail,*variants.calculated_price
region_id=<Polska region id>
limit=24
```

Contract guarantees relied upon (per product):

| Field | Guarantee |
|---|---|
| `title`, `handle`, `thumbnail` | present for every seeded product |
| `variants[0].calculated_price.calculated_amount` | gross PLN amount (tax-inclusive) |
| `variants[0].calculated_price.currency_code` | `"pln"` |

Catering attributes are **not** requested here — see `/store/catering-info` below.
Empirically, Medusa's built-in list/retrieve routes serve from the index engine
(`query.index`), which does not resolve custom module links even once explicitly
allow-listed via `req.allowed`; only `query.graph` (used server-side, and by the route
below) does.

## `GET /store/catering-info` (custom, contracts/http-api.md)

Batch-fetches catering attributes for a set of products in one request, keyed by
product id. No auth beyond the standard publishable-key header.

```
GET /store/catering-info?product_id=<id1>&product_id=<id2>
```

(a single comma-separated `product_id=<id1>,<id2>` value also works)

```json
{
  "catering_info": {
    "<id1>": {
      "id": "cpi_...",
      "min_quantity": 20,
      "quantity_step": 10,
      "pricing_unit": "piece",
      "ingredients": "...",
      "allergens": ["gluten", "fish", "milk"],
      "dietary_tags": []
    }
  }
}
```

A product with no catering info attached (should not happen for seeded products) is
simply absent from the map.

The storefront calls this route **in batch** for product lists: one request with all product
ids of a listing or category page (alongside `GET /store/products`), not one request per
product card. A product page calls it with a single id.

## `GET /store/regions` (Medusa built-in)

Storefront resolves the "Polska" region (currency `pln`) once and caches it.

## Admin

Medusa Admin served at `MEDUSA_BACKEND_URL/app`. No custom admin routes in this feature;
`src/admin/` contains only an empty extension placeholder (FR-014).

## Storefront cache revalidation (outbound)

After catalog changes the backend calls the storefront's revalidate endpoint
(`POST {CATERING_REVALIDATE_URL}`). See
[003-storefront-revalidation/contracts/revalidate.md](../../003-storefront-revalidation/contracts/revalidate.md).
