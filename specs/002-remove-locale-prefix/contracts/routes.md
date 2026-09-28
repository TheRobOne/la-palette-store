# Contract: Storefront routes (FR-001–FR-005)

Every route below drops its `/pl` (formerly `/[countryCode]`) prefix. No other segment of
any path changes. Page content and behaviour are unchanged (FR-006).

| Before | After |
|---|---|
| `/pl` | `/` |
| `/pl/store` | `/store` |
| `/pl/products/:handle` | `/products/:handle` |
| `/pl/categories/:category+` | `/categories/:category+` |
| `/pl/collections/:handle` | `/collections/:handle` |
| `/pl/regulamin` | `/regulamin` |
| `/pl/polityka-prywatnosci` | `/polityka-prywatnosci` |
| `/pl/cart` | `/cart` |
| `/pl/checkout` | `/checkout` |
| `/pl/account`, `/pl/account/*` | `/account`, `/account/*` |
| `/pl/order/:id/confirmed` | `/order/:id/confirmed` |
| `/pl/order/:id/transfer/:token[/accept\|/decline]` | `/order/:id/transfer/:token[/accept\|/decline]` |
| `/pl/verify-account` | `/verify-account` |
| `/api/payment-return` (already unprefixed) | unchanged, but its internal `redirect()` target drops `/pl` |

## Root behaviour (FR-004)

- `GET /` → renders the home page directly. **No 307/308 redirect is issued for
  locale/country purposes.** (A future feature may still redirect `/` for unrelated
  reasons, e.g. an A/B test — out of scope here.)
- Any of the routes above, requested without a leading `/pl`, resolve directly — this is
  automatic once the `[countryCode]` segment is removed from the route tree, since there
  is no other segment to match.

## Metadata (FR-005)

- `robots.ts`: `disallow`/`sitemap` entries reference locale-free paths (already true —
  it disallows/allows `/`, not `/pl`; no change needed there, verified in quickstart).
- `layout.tsx` `metadataBase` and any page-level canonical/OpenGraph URLs: unaffected,
  since they're built from `NEXT_PUBLIC_BASE_URL` + the (now locale-free) route path.

## Non-goal

Old `/pl/...` addresses are **not** kept working (spec.md Assumptions: pre-launch, no
real links exist yet). Requesting one resolves as a normal 404, like any other unknown
path — not a special case to build.
