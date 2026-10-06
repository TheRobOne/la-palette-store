/**
 * Idempotent store seed (spec: FR-003, FR-004, FR-004a; data-model.md).
 *
 * Every entity is looked up by its stable key and only created if missing,
 * so running this script twice never creates duplicates.
 *
 *   npx medusa exec ./src/scripts/seed.ts
 */
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createPricePreferencesWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  DEFAULT_MIN_ORDER_VALUE,
  MIN_ORDER_VALUE_METADATA_KEY,
} from "../lib/order-rules"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"
import type {
  Allergen,
  DietaryTag,
  PricingUnit,
} from "../modules/catering/models/catering-product-info"
import { STOCK_LOCATION_NAME, VENUE_ADDRESS } from "../lib/pickup"
import { setupPickup } from "./setup-pickup"

const REGION_NAME = "Polska"
const COUNTRY_CODE = "pl"
const CURRENCY_CODE = "pln"
const SALES_CHANNEL_NAME = "Sklep internetowy"
const PUBLISHABLE_KEY_TITLE = "Storefront"
const STORE_NAME = "La Palette Store"

const CATEGORIES = [
  { handle: "finger-food", name: "Finger food" },
  { handle: "desery", name: "Desery" },
] as const

type SampleProduct = {
  handle: string
  title: string
  description: string
  category: (typeof CATEGORIES)[number]["handle"]
  price: number
  image: string
  catering: {
    min_quantity: number
    quantity_step: number
    pricing_unit: PricingUnit
    ingredients: string
    allergens: Allergen[]
    dietary_tags: DietaryTag[]
  }
}

// All handles are prefixed `test-` and titles end in "(test)" so fictional
// sample data is unmistakably recognisable (spec Assumptions).
const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    handle: "test-tartaletki-lososiowe",
    title: "Tartaletki z łososiem (test)",
    description:
      "Kruche tartaletki z wędzonym łososiem i kremem serowym. Dane testowe.",
    category: "finger-food",
    price: 89,
    image: "1.svg",
    catering: {
      min_quantity: 20,
      quantity_step: 10,
      pricing_unit: "piece",
      ingredients:
        "Mąka pszenna, masło, łosoś wędzony, serek śmietankowy, koperek, cytryna.",
      allergens: ["gluten", "fish", "milk"],
      dietary_tags: [],
    },
  },
  {
    handle: "test-roladki-drobiowe",
    title: "Roladki drobiowe z suszonymi pomidorami (test)",
    description:
      "Roladki z piersi kurczaka z suszonymi pomidorami i bazylią. Dane testowe.",
    category: "finger-food",
    price: 75,
    image: "2.svg",
    catering: {
      min_quantity: 20,
      quantity_step: 10,
      pricing_unit: "piece",
      ingredients: "Pierś kurczaka, suszone pomidory, bazylia, oliwa z oliwek, czosnek.",
      allergens: [],
      dietary_tags: ["gluten_free"],
    },
  },
  {
    handle: "test-box-warzywny",
    title: "Box wegański z warzywami sezonowymi (test)",
    description: "Zestaw przekąsek warzywnych w wegańskim boxie. Dane testowe.",
    category: "finger-food",
    price: 45,
    image: "3.svg",
    catering: {
      min_quantity: 10,
      quantity_step: 5,
      pricing_unit: "person",
      ingredients: "Sezonowe warzywa, hummus, oliwa z oliwek, przyprawy.",
      allergens: ["sesame"],
      dietary_tags: ["vegan", "vegetarian", "gluten_free"],
    },
  },
  {
    handle: "test-mini-tarta-cytrynowa",
    title: "Mini tarta cytrynowa (test)",
    description: "Kruchy spód z lekkim kremem cytrynowym i bezą. Dane testowe.",
    category: "desery",
    price: 12,
    image: "4.svg",
    catering: {
      min_quantity: 12,
      quantity_step: 6,
      pricing_unit: "piece",
      ingredients: "Mąka pszenna, masło, jaja, cukier, cytryny.",
      allergens: ["gluten", "eggs", "milk"],
      dietary_tags: ["vegetarian"],
    },
  },
  {
    handle: "test-mus-czekoladowy",
    title: "Mus czekoladowy w kieliszku (test)",
    description: "Aksamitny mus z belgijskiej czekolady. Dane testowe.",
    category: "desery",
    price: 15,
    image: "5.svg",
    catering: {
      min_quantity: 12,
      quantity_step: 6,
      pricing_unit: "piece",
      ingredients: "Czekolada, śmietana kremówka, jaja, cukier.",
      allergens: ["milk", "eggs", "soybeans"],
      dietary_tags: ["vegetarian", "gluten_free"],
    },
  },
  {
    handle: "test-ciasteczka-owsiane",
    title: "Ciasteczka owsiane bez glutenu (test)",
    description: "Domowe ciasteczka owsiane na bazie mąki bezglutenowej. Dane testowe.",
    category: "desery",
    price: 8,
    image: "6.svg",
    catering: {
      min_quantity: 24,
      quantity_step: 12,
      pricing_unit: "piece",
      ingredients: "Płatki owsiane bezglutenowe, masło, miód, orzechy.",
      allergens: ["nuts"],
      dietary_tags: ["vegetarian", "gluten_free"],
    },
  },
]

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const cateringModuleService: CateringModuleService = container.resolve(
    CATERING_MODULE
  )

  const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

  // --- Sales channel -------------------------------------------------
  let { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
    filters: { name: SALES_CHANNEL_NAME },
  })
  let salesChannel: { id: string } = salesChannels[0]
  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    })
    salesChannel = result[0]
    logger.info(`Created sales channel "${SALES_CHANNEL_NAME}".`)
  } else {
    logger.info(`Sales channel "${SALES_CHANNEL_NAME}" already exists.`)
  }

  // --- Publishable API key --------------------------------------------
  const { data: apiKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "title", "token", "sales_channels.id"],
    filters: { title: PUBLISHABLE_KEY_TITLE },
  })
  let publishableKey = apiKeys[0]
  if (!publishableKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: PUBLISHABLE_KEY_TITLE, type: "publishable", created_by: "" },
        ],
      },
    })
    publishableKey = result[0] as unknown as typeof publishableKey
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: publishableKey.id, add: [salesChannel.id] },
    })
    logger.info(`Created publishable API key "${PUBLISHABLE_KEY_TITLE}".`)
  } else {
    logger.info(`Publishable API key "${PUBLISHABLE_KEY_TITLE}" already exists.`)
  }
  logger.info(`Storefront publishable key: ${publishableKey.token}`)

  // --- Region -----------------------------------------------------------
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
    filters: { name: REGION_NAME },
  })
  let region: { id: string } = regions[0]
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: CURRENCY_CODE,
            countries: [COUNTRY_CODE],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = result[0]
    logger.info(`Created region "${REGION_NAME}".`)
  } else {
    logger.info(`Region "${REGION_NAME}" already exists.`)
  }

  // --- Tax region (default 8% VAT) --------------------------------------
  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
    filters: { country_code: COUNTRY_CODE },
  })
  if (taxRegions.length === 0) {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: COUNTRY_CODE,
          provider_id: "tp_system",
          default_tax_rate: { rate: 8, name: "VAT 8%", code: "PL_VAT_8" },
        },
      ],
    })
    logger.info("Created tax region PL with default 8% VAT.")
  } else {
    logger.info("Tax region PL already exists.")
  }

  // --- Price preference: gross (tax-inclusive) PLN prices ---------------
  const { data: pricePreferences } = await query.graph({
    entity: "price_preference",
    fields: ["id", "attribute", "value"],
    filters: { attribute: "currency_code", value: CURRENCY_CODE },
  })
  if (pricePreferences.length === 0) {
    await createPricePreferencesWorkflow(container).run({
      input: [
        { attribute: "currency_code", value: CURRENCY_CODE, is_tax_inclusive: true },
      ],
    })
    logger.info("Created PLN tax-inclusive price preference.")
  } else {
    logger.info("PLN price preference already exists.")
  }

  // --- Stock location -----------------------------------------------------
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: STOCK_LOCATION_NAME },
  })
  let stockLocation: { id: string } = stockLocations[0]
  if (!stockLocation) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: STOCK_LOCATION_NAME,
            address: VENUE_ADDRESS,
          },
        ],
      },
    })
    stockLocation = result[0]
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`Created stock location "${STOCK_LOCATION_NAME}".`)
  } else {
    logger.info(`Stock location "${STOCK_LOCATION_NAME}" already exists.`)
  }

  // --- In-person pickup: the only fulfillment at launch -------------------
  await setupPickup(container)

  // --- Store: PLN default currency, default region + sales channel ------
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "metadata"],
  })
  if (stores.length === 0) {
    await createStoresWorkflow(container).run({
      input: {
        stores: [
          {
            name: STORE_NAME,
            supported_currencies: [{ currency_code: CURRENCY_CODE, is_default: true }],
            default_sales_channel_id: salesChannel.id,
            default_region_id: region.id,
            metadata: { [MIN_ORDER_VALUE_METADATA_KEY]: DEFAULT_MIN_ORDER_VALUE },
          },
        ],
      },
    })
    logger.info(`Created store "${STORE_NAME}".`)
  } else {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: stores[0].id },
        update: {
          name: STORE_NAME,
          supported_currencies: [{ currency_code: CURRENCY_CODE, is_default: true }],
          default_sales_channel_id: salesChannel.id,
          default_region_id: region.id,
          // Minimum order value is edited by staff in the Admin — only set
          // the default when it has never been configured.
          ...(stores[0].metadata?.[MIN_ORDER_VALUE_METADATA_KEY] === undefined
            ? {
                metadata: {
                  ...stores[0].metadata,
                  [MIN_ORDER_VALUE_METADATA_KEY]: DEFAULT_MIN_ORDER_VALUE,
                },
              }
            : {}),
        },
      },
    })
    logger.info(`Updated store "${STORE_NAME}".`)
  }

  // --- Sample catalog: only while no real catalog (seed-catalog.ts) exists,
  // so a deploy never brings the `test-` samples back. ---------------------
  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["handle"],
  })
  const hasRealCatalog = allProducts.some((p) => !p.handle?.startsWith("test-"))
  if (hasRealCatalog) {
    logger.info("Real catalog present — skipping sample categories and products.")
  } else {
    // --- Product categories -------------------------------------------------
    const categoryIds: Record<string, string> = {}
    for (const category of CATEGORIES) {
      const { data: existing } = await query.graph({
        entity: "product_category",
        fields: ["id", "handle"],
        filters: { handle: category.handle },
      })
      if (existing[0]) {
        categoryIds[category.handle] = existing[0].id
        continue
      }
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: [
            { name: category.name, handle: category.handle, is_active: true },
          ],
        },
      })
      categoryIds[category.handle] = result[0].id
      logger.info(`Created category "${category.name}".`)
    }

    // --- Sample products with catering info ---------------------------------
    const { data: fulfillmentSets } = await query.graph({
      entity: "shipping_profile",
      fields: ["id"],
    })
    let shippingProfileId = fulfillmentSets[0]?.id
    if (!shippingProfileId) {
      const created = await fulfillmentModuleService.createShippingProfiles({
        name: "Default",
        type: "default",
      })
      shippingProfileId = created.id
    }

    for (const sample of SAMPLE_PRODUCTS) {
      const { data: existingProducts } = await query.graph({
        entity: "product",
        fields: ["id", "handle"],
        filters: { handle: sample.handle },
      })

      let productId = existingProducts[0]?.id
      if (!productId) {
        const { result } = await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: sample.title,
                handle: sample.handle,
                description: sample.description,
                status: ProductStatus.PUBLISHED,
                category_ids: [categoryIds[sample.category]],
                shipping_profile_id: shippingProfileId,
                thumbnail: `${backendUrl}/static/placeholders/${sample.image}`,
                images: [{ url: `${backendUrl}/static/placeholders/${sample.image}` }],
                options: [{ title: "Wersja", values: ["Standard"] }],
                variants: [
                  {
                    title: "Standard",
                    manage_inventory: false,
                    options: { Wersja: "Standard" },
                    prices: [{ amount: sample.price, currency_code: CURRENCY_CODE }],
                  },
                ],
                sales_channels: [{ id: salesChannel.id }],
              },
            ],
          },
        })
        productId = result[0].id
        logger.info(`Created product "${sample.title}".`)
      }

      const { data: cateringInfos } = await query.graph({
        entity: "product",
        fields: ["id", "catering_product_info.id"],
        filters: { id: productId },
      })
      const hasCateringInfo = Boolean(
        (cateringInfos[0] as { catering_product_info?: { id: string } })
          ?.catering_product_info
      )
      if (!hasCateringInfo) {
        const created = await cateringModuleService.createCateringProductInfos({
          min_quantity: sample.catering.min_quantity,
          quantity_step: sample.catering.quantity_step,
          pricing_unit: sample.catering.pricing_unit,
          ingredients: sample.catering.ingredients,
          allergens: sample.catering.allergens,
          dietary_tags: sample.catering.dietary_tags,
        })
        await link.create({
          [Modules.PRODUCT]: { product_id: productId },
          [CATERING_MODULE]: { catering_product_info_id: created.id },
        })
        logger.info(`Linked catering info to "${sample.title}".`)
      }
    }
  }

  // --- Admin user (FR-004a): local uses fixed credentials; any other
  // APP_ENV requires ADMIN_EMAIL/ADMIN_PASSWORD from environment secrets. ---
  const appEnv = process.env.APP_ENV || "local"
  const adminEmail =
    appEnv === "local" ? "admin@lapalette.local" : process.env.ADMIN_EMAIL
  const adminPassword =
    appEnv === "local" ? "lapalette-local" : process.env.ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "ADMIN_EMAIL/ADMIN_PASSWORD required outside local (APP_ENV=" + appEnv + ")"
    )
  }

  const userModuleService = container.resolve(Modules.USER)
  const existingUsers = await userModuleService.listUsers({ email: adminEmail })
  if (existingUsers.length === 0) {
    const workflowEngineService = container.resolve(Modules.WORKFLOW_ENGINE)
    const authModuleService = container.resolve(Modules.AUTH)

    const { result: users } = await workflowEngineService.run(
      "create-users-workflow",
      { input: { users: [{ email: adminEmail }] } }
    )
    const user = users[0]

    const { authIdentity, error } = await authModuleService.register("emailpass", {
      body: { email: adminEmail, password: adminPassword },
    })
    if (error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to register admin auth identity: ${error}`
      )
    }
    await authModuleService.updateAuthIdentities({
      id: authIdentity!.id,
      app_metadata: { user_id: user.id },
    })
    logger.info(`Created admin user "${adminEmail}".`)
  } else {
    logger.info(`Admin user "${adminEmail}" already exists.`)
  }

  logger.info("Seed finished.")
}
