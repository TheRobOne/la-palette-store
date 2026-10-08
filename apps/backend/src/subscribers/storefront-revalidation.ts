import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createRevalidationQueue,
  REVALIDATION_EVENTS,
  resolveTags,
} from "../lib/storefront-revalidation"

let queue: ReturnType<typeof createRevalidationQueue> | undefined

/**
 * Tells the storefront which cached catalog pages to rebuild after a catalog
 * change. Errors are logged only; see src/lib/storefront-revalidation.ts.
 */
export default async function storefrontRevalidationHandler({
  event,
  container,
}: SubscriberArgs<{ id: string | string[] }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const tags = await resolveTags(query, event.name, event.data)
    queue ??= createRevalidationQueue({ logger })
    queue.add(tags)
  } catch (e) {
    logger.warn(
      `Storefront revalidation skipped for ${event.name}: ${(e as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: Object.values(REVALIDATION_EVENTS),
  context: {
    subscriberId: "storefront-revalidation",
  },
}
