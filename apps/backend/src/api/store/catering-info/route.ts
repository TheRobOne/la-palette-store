import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Batch catering info for a set of products, keyed by product id.
 *
 * The built-in `GET /store/products` route serves list/retrieve requests
 * from Medusa's index engine (`query.index`), which only resolves the
 * fields baked into its "product" index definition — a custom module link
 * like `catering_product_info` is invisible to it even once explicitly
 * allow-listed (verified empirically; not documented). This route uses
 * `query.graph` directly instead, which does resolve module links, so the
 * storefront fetches catering data from here in one extra request rather
 * than the single embedded `+catering_product_info.*` field the original
 * contract assumed (see specs/001-project-skeleton/contracts/http-api.md).
 *
 * `GET /store/catering-info?product_id=prod_1&product_id=prod_2`
 * `GET /store/catering-info?product_id=prod_1,prod_2` (comma-separated also works)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = req.query.product_id
  const ids = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .flatMap((v) => String(v).split(","))
    .filter(Boolean)

  if (ids.length === 0) {
    return res.status(200).json({ catering_info: {} })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "catering_product_info.*"],
    filters: { id: ids },
  })

  const catering_info: Record<string, unknown> = {}
  for (const product of data) {
    const info = (product as { catering_product_info?: unknown })
      .catering_product_info
    if (info) {
      catering_info[product.id as string] = info
    }
  }

  res.status(200).json({ catering_info })
}
