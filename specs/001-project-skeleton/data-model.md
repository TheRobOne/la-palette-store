# Data Model: Project Skeleton

**Feature**: 001-project-skeleton | **Date**: 2026-09-28

Most entities are Medusa built-ins configured by the seed. The only custom data model is
`catering_product_info` in the `catering` module (research R-05).

## Medusa built-in entities (configured, not modified)

| Entity | Seeded values | Stable lookup key (idempotency) |
|---|---|---|
| Store | name "La Palette Store", default currency `pln`, default region "Polska", default sales channel | singleton |
| Region | name "Polska", currency `pln`, countries `[pl]`, payment provider `pp_system_default` (placeholder until Przelewy24) | `name` |
| Tax Region | country `pl`, default rate "VAT 8%" = 8 | `country_code` |
| Price Preference | `currency_code = pln`, `is_tax_inclusive = true` | `attribute + value` |
| Sales Channel | "Sklep internetowy" | `name` |
| Publishable API Key | "Storefront", linked to sales channel | `title` |
| Stock Location | "Kuchnia La Palette" (address placeholder), linked to sales channel + manual fulfillment | `name` |
| Product Category | 2 sample categories: `finger-food` "Finger food", `desery` "Desery" — only while no real catalog exists (see below) | `handle` |
| Product | ≥ 6 fictional products (≥ 3 per category), status `published`, 1 variant each, PLN price, placeholder thumbnail — only while no real catalog exists (see below) | `handle` (prefix `test-`) |
| User (admin) | local: `admin@lapalette.local`; other envs: `ADMIN_EMAIL` | `email` |

### Product (sample) rules

- `handle` MUST start with `test-` and `title` MUST end with "(test)" so fictional data
  is recognisable (FR-004).
- Price stored as **gross** PLN amount (price preference tax-inclusive), e.g. `89.00`.
- `thumbnail` = `${MEDUSA_BACKEND_URL}/static/placeholders/<n>.svg` (research R-09).
- Inventory not managed (`manage_inventory = false`) — capacity rules belong to a later
  feature.

### Catalog import (`seed-catalog.ts`)

The sample categories and products are created only when the database holds no product
outside the `test-` prefix, so a deploy (`predeploy` runs the seed) never re-adds them
next to a real catalog. The catalog itself comes from a separate, manually run script —
not part of `predeploy`:

```bash
npx medusa exec ./src/scripts/seed-catalog.ts   # after the seed
```

It deletes all `test-` products (catering info cascades) and the `finger-food` category,
then creates — idempotently by `handle` — the categories and products from
`apps/backend/src/scripts/data/catalog.ts`. Current content (2026-10-05): a working
baseline mirrored from megustacatering.pl, to be replaced with La Palette texts and
prices before launch.

| Category (`handle`, rank order) | Products | Pricing |
|---|---|---|
| `boxy-wytrawne` "Boxy wytrawne" | 20 | per box (4–6 persons), `piece`, min 1 |
| `boxy-slodkie` "Boxy słodkie" | 3 | per box, `piece`, min 1 |
| `dla-dzieci` "Dla dzieci" | 2 | per box, `piece`, min 1 |
| `przerwy-kawowe` "Przerwy kawowe" | 3 | `person`, min 12 |
| `dania-obiadowe` "Dania obiadowe" | 21 | `portion` / `piece`, min 10 |
| `bowle` "Bowle" | 5 | `piece`, min 5 |
| `desery` "Desery" | 4 | `piece`, min 10 |
| `napoje` "Napoje" | 2 | `piece`, min 10 |

Catalog rules: 1 variant "Standard" with gross PLN price, `quantity_step = 1`, placeholder
thumbnail, `metadata.source = "megustacatering.pl"`, box size/weight in `subtitle`.
`allergens` are empty for every product (the source publishes none) and MUST be filled
in before launch.

## Custom: `catering_product_info` (module `catering`)

| Field | Type | Rules |
|---|---|---|
| `id` | id (prefix `cpi`) | primary key |
| `min_quantity` | integer | ≥ 1; default 1 |
| `quantity_step` | integer | ≥ 1; default 1 |
| `pricing_unit` | enum `piece` \| `portion` \| `person` | required |
| `ingredients` | text | required, non-empty (Polish) |
| `allergens` | array of enum (14 EU allergens, see below) | may be empty; unique values |
| `dietary_tags` | array of enum `vegetarian` \| `vegan` \| `gluten_free` \| `lactose_free` | may be empty |
| `created_at` / `updated_at` / `deleted_at` | timestamps | managed by Medusa |

**Allergen enum** (Regulation (EU) 1169/2011, Annex II): `gluten`, `crustaceans`, `eggs`,
`fish`, `peanuts`, `soybeans`, `milk`, `nuts`, `celery`, `mustard`, `sesame`,
`sulphites`, `lupin`, `molluscs`. Polish display labels live in storefront
`messages/pl.json`.

### Relationship

- Module link `product` ↔ `catering_product_info`: **one-to-one**, deleting a product
  cascades to its catering info.
- Exposed on the Store API via the dedicated `GET /store/catering-info` batch endpoint,
  not embedded in `GET /store/products` (research R-06a; see
  [contracts/http-api.md](contracts/http-api.md)).

### Validation

- Every seeded or imported product gets exactly one `catering_product_info` row.
- `min_quantity` MUST be a multiple of `quantity_step` (enforced in the module service;
  used later by cart validation).

## State transitions

None in this feature (no orders, carts or payments). Product `status` is seeded as
`published`.
