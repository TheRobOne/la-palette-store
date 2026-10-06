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
