# Feature Specification: Storefront Catalog Revalidation

**Feature Branch**: `003-storefront-revalidation`

**Created**: 2026-10-06

**Status**: Implemented

**Input**: User description: "Subscriber rewalidacji katalogu storefrontu + porządki po
integracji katalogu." The storefront (la-palette-garden, `lapalettegarden.pl/catering`) serves
the catalog as static pages cached with Next.js tags; Admin changes must show up within
seconds instead of after the 1 h fallback.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin edit is visible on the shop within seconds (Priority: P1)

The shop owner edits a product (title, description, price, category, catering info) in Medusa
Admin, opens `lapalettegarden.pl/catering` and sees the change after a few seconds.

**Why this priority**: without it every catalog fix waits up to an hour, which is the whole
point of the feature.

**Independent Test**: edit a product's price in Admin; the backend log shows
`Storefront revalidated: products, product:<handle>` and the product page shows the new price
on the next request.

**Acceptance Scenarios**:

1. **Given** the revalidation URL and secret are configured, **When** a product is created or
   updated, **Then** the backend calls the storefront with `products` and
   `product:<handle>`.
2. **Given** the same, **When** a variant price is edited in Admin, **Then** the call contains
   the tags of the variant's product.
3. **Given** the same, **When** a category is created, updated or deleted, **Then** the call
   contains `categories` and `products`.
4. **Given** the same, **When** a product is deleted, **Then** the call contains `products`.
5. **Given** the same, **When** a product's catering info is created or updated, **Then** the
   call contains `products` and, if the info is already linked, `product:<handle>`.

### User Story 2 - Revalidation never breaks Admin work (Priority: P1)

Whatever happens to the storefront (down, slow, wrong secret), the Admin operation succeeds and
the problem only appears in the backend log.

**Independent Test**: point `CATERING_REVALIDATE_URL` at an unreachable host, edit a product;
the edit succeeds and a single warning is logged within about 5 s.

**Acceptance Scenarios**:

1. **Given** the URL or secret is unset (local development), **When** the catalog changes,
   **Then** no HTTP call is made and one info line is logged.
2. **Given** the storefront answers non-2xx or does not answer within ~5 s, **When** the call
   is made, **Then** a warning is logged and nothing is thrown.

### Edge Cases

- Bulk changes (catalog import of ~60 products, a product edit that also emits variant events):
  tags arriving within 1 s are merged into one call, deduplicated.
- More than 50 distinct tags: per-product tags are dropped, `products` covers every product
  page.
- A handle that does not match `^[a-z0-9-]+$`: only `products` is sent for it.
- Deleted variants / catering info: the row cannot be resolved any more, so only `products` is
  sent.
- Scripts run by `medusa exec` exit before the 1 s batch fires; `seed-catalog` therefore calls
  the storefront explicitly at the end.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend MUST map catalog events to cache tags as defined in
  [contracts/revalidate.md](contracts/revalidate.md).
- **FR-002**: Product handles MUST be resolved with `query.graph` (product, variant → product,
  catering info → product link).
- **FR-003**: The HTTP call MUST time out after ~5 s, MUST NOT throw, and MUST only log
  failures.
- **FR-004**: Without `CATERING_REVALIDATE_URL` or `CATERING_REVALIDATE_SECRET` the call MUST be
  skipped with one info log.
- **FR-005**: Tags MUST be deduplicated per call and limited to 50.
- **FR-006**: Mapping and HTTP logic MUST live in one helper covered by unit tests without a
  database.
- **FR-007**: The secret MUST NOT be committed or logged.

### Housekeeping (same change)

- **HK-001**: `static/placeholders/2.svg` text colour equals its background; make it readable
  (also `1.svg`, whose background `fill="#"` is invalid).
- **HK-002**: `specs/001-project-skeleton/contracts/http-api.md` documents that the storefront
  calls `/store/catering-info` in batch for product lists, and links the revalidation contract.
- **HK-003**: `apps/backend/AGENTS.md` describes the revalidation contract.
- **HK-004**: Constitution `TODO(FRONTEND_HOSTING)` — see research R-06 (no such TODO exists;
  the 2.1.0 amendment already names Vercel).

## Success Criteria *(mandatory)*

- **SC-001**: A price edit in Admin is visible on the product page within 10 s.
- **SC-002**: With the storefront unreachable, Admin edits succeed and take no longer than
  without this feature.
- **SC-003**: `pnpm run lint` and `pnpm run test:unit` pass.

## Assumptions

- The storefront endpoint and its tags are owned by la-palette-garden
  (`src/catering/AGENTS.md`); this repo is the client.
- Single backend process (`MEDUSA_WORKER_MODE=shared`) with the in-memory event bus; batching is
  in-process.
- Allergens are not displayed by the storefront and are out of scope.
