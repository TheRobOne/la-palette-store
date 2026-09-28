import ProductModule from "@medusajs/medusa/product"
import CateringModule from "../modules/catering"
import { defineLink } from "@medusajs/framework/utils"

/**
 * One-to-one link: deleting a product cascades to its catering info.
 * See specs/001-project-skeleton/data-model.md, Relationship.
 */
export default defineLink(ProductModule.linkable.product, {
  linkable: CateringModule.linkable.cateringProductInfo,
  deleteCascade: true,
})
