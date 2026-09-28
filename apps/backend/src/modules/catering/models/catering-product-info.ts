import { model } from "@medusajs/framework/utils"

/**
 * The 14 EU allergens (Regulation (EU) No 1169/2011, Annex II).
 */
export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soybeans",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const

export type Allergen = (typeof ALLERGENS)[number]

export const DIETARY_TAGS = [
  "vegetarian",
  "vegan",
  "gluten_free",
  "lactose_free",
] as const

export type DietaryTag = (typeof DIETARY_TAGS)[number]

export const PRICING_UNITS = ["piece", "portion", "person"] as const

export type PricingUnit = (typeof PRICING_UNITS)[number]

/**
 * Catering-specific attributes for a product: minimum order quantity, the
 * unit prices are quoted in, ingredients and the 14 EU allergens.
 * See specs/001-project-skeleton/data-model.md.
 */
const CateringProductInfo = model.define("catering_product_info", {
  id: model.id({ prefix: "cpi" }).primaryKey(),
  // ≥ 1; default 1
  min_quantity: model.number().default(1),
  // ≥ 1; default 1
  quantity_step: model.number().default(1),
  pricing_unit: model.enum([...PRICING_UNITS]),
  // required, non-empty (Polish)
  ingredients: model.text(),
  // may be empty; unique values
  allergens: model.json<Allergen[]>().default([]),
  // may be empty
  dietary_tags: model.json<DietaryTag[]>().default([]),
})

export default CateringProductInfo
