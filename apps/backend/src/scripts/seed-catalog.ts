/**
 * Idempotent catalog import: replaces the `test-` sample products with the
 * catalog from ./data/catalog.ts. Run after `seed` (needs its sales channel):
 *
 *   npx medusa exec ./src/scripts/seed-catalog.ts
 *
 * Not part of `predeploy` — run it by hand against the target database.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { revalidateStorefront } from "../lib/storefront-revalidation"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"
import {
  CATALOG_CATEGORIES,
  CATALOG_PRODUCTS,
  CATALOG_SOURCE,
} from "./data/catalog"

const SALES_CHANNEL_NAME = "Sklep internetowy"
const RETIRED_CATEGORY_HANDLES = ["finger-food"]
const PLACEHOLDER_COUNT = 6

export default async function seedCatalog({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const cateringModuleService: CateringModuleService = container.resolve(
    CATERING_MODULE
  )
  const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
    filters: { name: SALES_CHANNEL_NAME },
  })
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  if (!salesChannels[0] || !shippingProfiles[0]) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Sales channel or shipping profile missing — run the seed script first"
    )
  }
  const salesChannelId = salesChannels[0].id
  const shippingProfileId = shippingProfiles[0].id

  // --- Remove `test-` sample products (catering info cascades via link) ---
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })
  const samples = products.filter((p) => p.handle?.startsWith("test-"))
  if (samples.length > 0) {
    await deleteProductsWorkflow(container).run({
      input: { ids: samples.map((p) => p.id) },
    })
    logger.info(`Removed ${samples.length} sample products.`)
  }

  const { data: retiredCategories } = await query.graph({
    entity: "product_category",
    fields: ["id"],
    filters: { handle: RETIRED_CATEGORY_HANDLES },
  })
  if (retiredCategories.length > 0) {
    await deleteProductCategoriesWorkflow(container).run({
      input: retiredCategories.map((c) => c.id),
    })
    logger.info(`Removed ${retiredCategories.length} retired categories.`)
  }

  // --- Categories --------------------------------------------------------
  const categoryIds: Record<string, string> = {}
  for (const [rank, category] of CATALOG_CATEGORIES.entries()) {
    const { data: existing } = await query.graph({
      entity: "product_category",
      fields: ["id"],
      filters: { handle: category.handle },
    })
    if (existing[0]) {
      categoryIds[category.handle] = existing[0].id
      continue
    }
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          { name: category.name, handle: category.handle, is_active: true, rank },
        ],
      },
    })
    categoryIds[category.handle] = result[0].id
    logger.info(`Created category "${category.name}".`)
  }

  // --- Products with catering info ---------------------------------------
  let created = 0
  for (const [index, item] of CATALOG_PRODUCTS.entries()) {
    const { data: existing } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: { handle: item.handle },
    })
    if (existing[0]) {
      continue
    }

    const image = `${backendUrl}/static/placeholders/${(index % PLACEHOLDER_COUNT) + 1}.svg`
    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: item.title,
            subtitle: item.subtitle ?? undefined,
            handle: item.handle,
            description: item.description,
            status: ProductStatus.PUBLISHED,
            category_ids: [categoryIds[item.category]],
            shipping_profile_id: shippingProfileId,
            thumbnail: image,
            images: [{ url: image }],
            metadata: { source: CATALOG_SOURCE },
            options: [{ title: "Wersja", values: ["Standard"] }],
            variants: [
              {
                title: "Standard",
                manage_inventory: false,
                options: { Wersja: "Standard" },
                prices: [{ amount: item.price, currency_code: "pln" }],
              },
            ],
            sales_channels: [{ id: salesChannelId }],
          },
        ],
      },
    })

    const info = await cateringModuleService.createCateringProductInfos({
      min_quantity: item.min_quantity,
      quantity_step: 1,
      pricing_unit: item.pricing_unit,
      ingredients: item.ingredients,
      allergens: [],
      dietary_tags: item.dietary_tags,
    })
    await link.create({
      [Modules.PRODUCT]: { product_id: result[0].id },
      [CATERING_MODULE]: { catering_product_info_id: info.id },
    })
    created++
  }

  logger.info(
    `Catalog import finished: ${created} created, ${CATALOG_PRODUCTS.length - created} already present.`
  )

  // `medusa exec` exits right after this function, before the subscriber's
  // batched revalidation fires, so tell the storefront explicitly.
  await revalidateStorefront(["products", "categories"], { logger })
}
