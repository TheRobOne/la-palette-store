# Contract: Storefront cache revalidation (outbound)

The backend is the **client** of this endpoint. The endpoint and its tags are owned by
la-palette-garden (`src/catering/AGENTS.md` is the source of truth); this document records
what the backend sends and when.

## Request

```
POST {CATERING_REVALIDATE_URL}          # e.g. https://www.lapalettegarden.pl/api/catering/revalidate
x-revalidate-secret: <CATERING_REVALIDATE_SECRET>
Content-Type: application/json

{ "tags": ["products", "product:wloski", "categories"] }
```

- Allowed tags: `products`, `categories`, `regions`, `product:<handle>` (handle matches
  `^[a-z0-9-]+$`); 1–50 tags per call.
- `products` invalidates lists, categories, sitemap and every product page;
  `product:<handle>` one product page; `categories` the category navigation; `regions` the
  cached region.

## Responses

| Status | Meaning | Backend reaction |
|---|---|---|
| 200 `{"revalidated":[...]}` | done | info log |
| 400 | bad body or tag | warn log |
| 401 | wrong secret | warn log |
| 500 | secret not set on the storefront | warn log |
| timeout (5 s) / network error | — | warn log |

The backend never retries and never throws; the storefront's 1 h revalidation is the
fallback.

## Events → tags

Event names verified in `@medusajs/core-flows` / `@medusajs/utils` 2.21.1 (research R-01..R-04).

| Event | Payload | Tags |
|---|---|---|
| `product.created`, `product.updated` | `{ id }` product | `products`, `product:<handle>` |
| `product.deleted` | `{ id }` | `products` |
| `product-variant.created`, `product-variant.updated` | `{ id }` variant | `products`, `product:<handle of variant's product>` |
| `product-variant.deleted` | `{ id }` | `products` |
| `product-category.created/updated/deleted` | `{ id }` | `categories`, `products` |
| `region.created/updated/deleted` | `{ id }` | `regions` |
| `catering.catering-product-info.created/updated` | `{ id: string \| string[] }` | `products`, `product:<handle>` via the product link (only `products` if not linked yet) |
| `catering.catering-product-info.deleted` | `{ id }` | `products` |

## Delivery rules

- Tags from events arriving within **1 s** are merged into one call (in-process batch).
- Tags are deduplicated; above 50, `product:*` tags are dropped (`products` covers them).
- `CATERING_REVALIDATE_URL` or `CATERING_REVALIDATE_SECRET` unset → no call, one info log
  (normal in local development).
- `src/scripts/seed-catalog.ts` sends `products`, `categories` itself at the end, because
  `medusa exec` exits before the batch fires.

## Not covered (no event emitted by Medusa 2.21.1)

- Adding/removing products on the **category** page in Admin
  (`batchLinkProductsToCategoryWorkflow`) — changing categories on the product page emits
  `product.updated` and is covered.
- Price list changes (`price-list` workflows) — the shop does not use price lists.
