# Data Model: Storefront Catalog Revalidation

No data model change. The feature reads `product.handle`, `product_variant.product.handle` and
`catering_product_info.product.handle` (existing link `src/links/product-catering.ts`).
