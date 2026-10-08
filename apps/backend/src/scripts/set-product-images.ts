/**
 * Points each product at its photo in static/products/<handle>.<ext>,
 * replacing the placeholder thumbnail. Idempotent; rerun after adding photos:
 *
 *   npx medusa exec ./src/scripts/set-product-images.ts
 */
import fs from "node:fs"
import path from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

const PRODUCT_IMAGES_DIR = path.join(process.cwd(), "static", "products")
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])

export default async function setProductImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

  const files = fs
    .readdirSync(PRODUCT_IMAGES_DIR)
    .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))

  let updated = 0
  for (const file of files) {
    const handle = path.basename(file, path.extname(file))
    const url = `${backendUrl}/static/products/${file}`

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "thumbnail"],
      filters: { handle },
    })
    const product = products[0]
    if (!product) {
      logger.warn(`No product with handle "${handle}" — skipping ${file}.`)
      continue
    }
    if (product.thumbnail === url) {
      continue
    }

    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: product.id },
        update: { thumbnail: url, images: [{ url }] },
      },
    })
    updated++
    logger.info(`Set image for "${handle}".`)
  }

  logger.info(
    `Product images: ${updated} updated, ${files.length - updated} unchanged or skipped.`
  )
}
