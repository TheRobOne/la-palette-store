import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http'

// Clarification: staging (and any non-`ALLOW_INDEXING=true` environment) is
// public but must not be indexed by search engines — including /app (Admin).
function noIndexHeader(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (process.env.ALLOW_INDEXING !== 'true') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  }
  next()
}

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      method: ['GET', 'POST', 'PUT', 'DELETE'],
      matcher: '*',
      middlewares: [noIndexHeader],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
})
