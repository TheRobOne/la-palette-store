# Quickstart & Validation: Remove Locale/Country Code from Storefront URLs

Prerequisites: local environment running per
`specs/001-project-skeleton/quickstart.md` V1 (`pnpm dev`, backend + storefront up,
seeded).

## V1 — Locale-free addresses (US1, SC-001–SC-003)

```bash
curl -sI http://localhost:8000/ | head -1          # expect 200, not a 307/308
curl -s http://localhost:8000/ | grep -c 'href="/[a-z]\{2\}/'   # expect 0
```

Manually, in a browser:

1. Open `http://localhost:8000/` → home page loads directly; address bar stays at `/`
   (no flash-redirect to `/pl`).
2. Open a product page (link from the home grid) → address has no locale segment, e.g.
   `/products/test-tartaletki-lososiowe`.
3. Open `/regulamin` and `/polityka-prywatnosci` directly → both load without a locale
   segment.
4. View source / inspect the header and footer links → none start with `/pl/` or any
   other two-letter segment.

## V2 — No content/behaviour change (FR-006, SC-004)

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build
pnpm test:e2e
```

Expected: all green, same as `specs/001-project-skeleton/quickstart.md` V4 — the
Playwright smoke test still finds a "(test)" product and a "zł" price with zero axe
violations, now at `/` instead of `/pl`.

## V3 — Manual spot-check of moved flows

1. `/cart`, `/checkout` load without a locale segment (still functionally out of scope
   per 001-project-skeleton, but must not 404 or crash).
2. `/account` redirects/loads sensibly without a locale segment.
