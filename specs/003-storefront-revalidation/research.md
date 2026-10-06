# Research: Storefront Catalog Revalidation

All findings were checked against the installed Medusa 2.21.1 packages (paths relative to
`node_modules/@medusajs/`), not from memory. Runtime checks are marked as such.

## R-01 Product events

- `core-flows/dist/product/workflows/create-products.js` emits `product.created`,
  `update-products.js` `product.updated`, `delete-products.js` `product.deleted`; payload
  `{ id }` per product (`emitEventStep` emits one message per array item).
- `create-and-link-product-options-to-product.js` also emits `product.updated`.
- Admin: `POST /admin/products/:id` → `updateProductsWorkflow`; `DELETE` →
  `deleteProductsWorkflow` (`medusa/dist/api/admin/products/[id]/route.js`).

## R-02 Price edits

- Admin price editor (`dashboard/dist/hooks.js`, `useUpdateProductVariantsBatch`) calls
  `sdk.admin.product.batchVariants` → `POST /admin/products/:id/variants/batch` →
  `batchProductVariantsWorkflow`, which runs `updateProductVariantsWorkflow` as a step.
- The single-variant form uses `POST /admin/products/:id/variants/:variant_id` →
  `updateProductVariantsWorkflow` directly.
- `update-product-variants.js` updates the price sets (`updatePriceSetsStep`) and emits
  `product-variant.updated` with `{ id: variant_id }` for every updated variant, including
  price-only updates. Also emitted: `product-variant.created` / `.deleted`.
- No `product.updated` is emitted for a price edit, so the subscriber resolves
  variant → `product.handle` (runtime-checked with `query.graph` on the dev DB).
- Price lists: `core-flows/dist/price-list/workflows/*` emit no events. Not used by the shop.

## R-03 Category events

- `product-category/workflows/{create,update,delete}-product-categories.js` emit
  `product-category.created/updated/deleted` with `{ id }`.
- `POST /admin/product-categories/:id/products` (adding products from the category page) runs
  `batchLinkProductsToCategoryWorkflow`, which emits **no** event. Assigning a category on the
  product page goes through `updateProductsWorkflow` → `product.updated`.
- Gap accepted: the fallback is 1 h. If it matters later, the simplest fix is a custom
  middleware/route wrapper or calling the helper from an Admin route — not done now
  (Principle VII).

## R-04 Catering module events

- `MedusaService` (`utils/dist/modules-sdk/medusa-service.js`) wraps every generated method
  with `@EmitEvents` and forwards MikroORM `afterCreate/afterUpdate/afterDelete` to
  `interceptEntityMutationEvents`, which builds the name with
  `buildModuleResourceEventName({ prefix: <module key>, objectName: snake(model), action })`.
- The module key comes from `moduleResolution.definition.key`
  (`modules-sdk/dist/loaders/utils/load-internal.js`) = `"catering"`; the model class is
  `CateringProductInfo`. Computed with the installed utils:
  `catering.catering-product-info.updated` (same for `created`, `deleted`).
- Payload: `{ id }` for one row, `{ id: string[] }` when one call touched several rows
  (`event-builder-factory.js`). Emitted with `internal: true`, which only suppresses the
  "Processing … event" log in the local event bus (`event-bus-local.js`); subscribers still
  receive it.
- The overridden `createCateringProductInfos` / `updateCateringProductInfos` call `super`,
  whose generated implementation carries the decorators, so events are emitted. **Runtime
  emission not yet observed** — verify with the quickstart.
- Catering info → product: `query.graph({ entity: "catering_product_info", fields:
  ["product.handle"] })` resolves through the link (runtime-checked on the dev DB). On
  `created` the link does not exist yet (`seed-catalog` creates the info, then the link), so
  only `products` is sent.
- Today no Admin UI edits catering info; only scripts do. A future Admin widget will be
  covered automatically as long as it goes through the module service.

## R-05 Batching and `medusa exec`

- `medusa exec` loads subscribers (`medusa/dist/loaders/index.js`) and calls
  `process.exit()` right after the script (`commands/exec.js`), so in-process timers do not
  fire. Decision: 1 s in-process batch for the server, plus an explicit awaited call at the
  end of `seed-catalog`.
- Alternatives rejected: Redis/queue (Principle VII; the in-memory event bus is enough for one
  process), per-event calls without batching (~120 calls on import).
- Per-product tags are redundant with `products` per the storefront contract, but are sent as
  requested; above 50 tags they are dropped.

## R-06 Constitution `TODO(FRONTEND_HOSTING)`

- No `TODO(FRONTEND_HOSTING)` exists in the committed constitution (2.0.0) nor in git history
  (`git log -S`). The pending 2.1.0 amendment (uncommitted working copy) already states that
  la-palette-garden is hosted on Vercel on a commercial plan. No amendment needed; committing
  2.1.0 publishes it.
