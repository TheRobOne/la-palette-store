# Quickstart: manual end-to-end check

1. In la-palette-garden, note `CATERING_REVALIDATE_SECRET` (Vercel project, or the local
   `.env.local` when testing against `next dev`).
2. In `apps/backend/.env` set:
   ```
   CATERING_REVALIDATE_URL=https://www.lapalettegarden.pl/api/catering/revalidate
   CATERING_REVALIDATE_SECRET=<same value>
   ```
   (or `http://localhost:3000/api/catering/revalidate` with the garden dev server).
3. Check the endpoint by hand first:
   ```
   curl -i -X POST "$CATERING_REVALIDATE_URL" \
     -H "x-revalidate-secret: $CATERING_REVALIDATE_SECRET" \
     -H "content-type: application/json" -d '{"tags":["products"]}'
   ```
   Expect `200 {"revalidated":["products"]}`; `401` means the secrets differ.
4. `pnpm dev`, open Admin (`http://localhost:9000/app`) and:
   - change a product title → log `Storefront revalidated: products, product:<handle>`;
   - change a variant price (Edit prices) → the same line for that product;
   - rename a category → `Storefront revalidated: categories, products`.
   Lines appear about 1 s after the save. A warning line shows the HTTP status or error.
5. Reload the product page on the storefront: the change is visible.
6. Catering info (no Admin UI yet): run
   `pnpm exec medusa exec ./src/scripts/seed-catalog.ts` on a database with the catalog
   already imported; the last line is `Storefront revalidated: products, categories`.
7. Negative check: unset both variables, edit a product → one info line
   `Storefront revalidation skipped (...)`, the edit succeeds.
