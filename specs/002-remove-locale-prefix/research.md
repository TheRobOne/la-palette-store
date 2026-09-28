# Research: Remove Locale/Country Code from Storefront URLs

**Feature**: 002-remove-locale-prefix | **Date**: 2026-09-28

Source: the existing `apps/storefront` codebase (official Medusa Next.js Starter,
restyled in 001-project-skeleton), inspected directly — no external docs needed for this
feature (a routing/refactor change, not a new Medusa capability).

## R-01 Current mechanism (what this feature removes)

- Every route lives under `src/app/[countryCode]/(main)/...` or
  `src/app/[countryCode]/(checkout)/...`, a Next.js dynamic route segment.
- `src/middleware.ts` fetches `/store/regions`, builds a country-code → region map, reads
  the code from the URL, Cloudflare/Vercel geo headers or `NEXT_PUBLIC_DEFAULT_REGION`,
  and 307-redirects any request without a matching leading segment to one that has it
  (`/` → `/pl`, `/produkty` → `/pl/produkty`, ...). It also sets a `_medusa_cache_id`
  cookie on first visit (consumed by `lib/data/cookies.ts` → `getCacheOptions`, used to
  scope Next's fetch cache tags — unrelated to locale, must be kept).
- `lib/data/regions.ts` → `getRegion(countryCode)` resolves a `HttpTypes.StoreRegion` by
  country code, cached in a module-level `Map`.
- 15 other files read `countryCode` from `useParams()`/route `params` to: call
  `getRegion(countryCode)` (products, categories, collections, store, home), build a
  `redirect()` target (`cart.ts`, `customer.ts`, `payment-return/route.ts`), or prefix
  links (`localized-client-link`, `account-nav`, `payment-button`).
- `modules/common/components/localized-client-link` wraps `next/link` and prefixes every
  `href` with `/${countryCode}` from `useParams()`.

## R-02 Target mechanism

- **Decision**: Move `[countryCode]/(main)` → `(main)` and `[countryCode]/(checkout)` →
  `(checkout)`, both directly under `src/app/`, deleting the `[countryCode]` segment.
  `getRegion()` becomes a zero-argument function that resolves the single Poland region
  once (still by `NEXT_PUBLIC_DEFAULT_REGION`, kept as the one configured region code, so
  the "which region" decision stays in one place — env config — not hard-coded in code).
  Every caller drops the `countryCode` argument. `redirect()` calls drop the
  `/${countryCode}` prefix. `LocalizedClientLink` drops its prefixing entirely and simply
  forwards to `next/link`. `middleware.ts` drops all country-code detection/redirect logic
  and keeps only the `_medusa_cache_id` cookie bootstrap.
- **Rationale**: Matches FR-001–FR-004: no code left that can reintroduce a locale
  segment, single source of truth for "which region" stays server-side config (not the
  URL), minimal-diff on the ~15 call sites that only need one parameter removed.
- **Alternatives considered**: keep `[countryCode]` as a route segment but always redirect
  to a fixed value (rejected — still puts a segment in every URL, doesn't satisfy FR-001);
  a Next.js rewrite that hides the segment from the visible URL while keeping it
  internally (rejected — adds a layer of indirection and an internal special-case for no
  benefit, against Constitution VII).

## R-03 Dead code uncovered during inspection

- `modules/layout/components/side-menu` is not imported anywhere (the header/footer were
  rewritten from scratch in 001-project-skeleton without it). Its only two dependents,
  `modules/layout/components/country-select` and `modules/layout/components/language-select`,
  are therefore also unused.
- **Decision**: delete all three files as part of this feature (Constitution VII:
  unused code is a simpler-alternative violation waiting to happen — cheaper to remove now
  than to also migrate their now-broken `useParams().countryCode` reads for no reader).
- **Not affected**: `modules/checkout/components/country-select` is a different component
  (a country `<select>` for a shipping/billing address form field) — unrelated to URL
  locale routing, stays as-is.

## R-04 Verification approach

- No new automated test framework needed. Constitution VI's bar (tests for critical paths)
  doesn't apply here — no cart/checkout price or date logic changes. FR-006 ("no page's
  content or behaviour changes") is verified by the existing Playwright smoke test and a
  manual link scan (quickstart), plus lint/typecheck/build already catching any leftover
  `countryCode` reference (removing the route segment makes `params.countryCode` a type
  error anywhere still expecting it).
