import type { Logger } from "@medusajs/framework/types"

/**
 * Storefront cache revalidation (specs/003-storefront-revalidation).
 *
 * The storefront (la-palette-garden, lapalettegarden.pl/catering) serves the
 * catalog from Next.js cache tags. When the catalog changes in the Admin, the
 * backend POSTs the affected tags to the storefront's revalidate endpoint so
 * the change is visible within seconds instead of after the 1 h fallback.
 * Contract: specs/003-storefront-revalidation/contracts/revalidate.md.
 */

export const REVALIDATION_EVENTS = {
  PRODUCT_CREATED: "product.created",
  PRODUCT_UPDATED: "product.updated",
  PRODUCT_DELETED: "product.deleted",
  VARIANT_CREATED: "product-variant.created",
  VARIANT_UPDATED: "product-variant.updated",
  VARIANT_DELETED: "product-variant.deleted",
  CATEGORY_CREATED: "product-category.created",
  CATEGORY_UPDATED: "product-category.updated",
  CATEGORY_DELETED: "product-category.deleted",
  REGION_CREATED: "region.created",
  REGION_UPDATED: "region.updated",
  REGION_DELETED: "region.deleted",
  // Emitted automatically by MedusaService for the catering module's model:
  // `<module key>.<kebab-case model>.<action>`.
  CATERING_INFO_CREATED: "catering.catering-product-info.created",
  CATERING_INFO_UPDATED: "catering.catering-product-info.updated",
  CATERING_INFO_DELETED: "catering.catering-product-info.deleted",
} as const

export type RevalidationEvent =
  (typeof REVALIDATION_EVENTS)[keyof typeof REVALIDATION_EVENTS]

/** Graph entity whose ids an event carries, when a product handle is needed. */
type HandleSource = "product" | "product_variant" | "catering_product_info"

const E = REVALIDATION_EVENTS

const HANDLE_SOURCES: Partial<Record<RevalidationEvent, HandleSource>> = {
  [E.PRODUCT_CREATED]: "product",
  [E.PRODUCT_UPDATED]: "product",
  [E.VARIANT_CREATED]: "product_variant",
  [E.VARIANT_UPDATED]: "product_variant",
  [E.CATERING_INFO_CREATED]: "catering_product_info",
  [E.CATERING_INFO_UPDATED]: "catering_product_info",
}

const STATIC_TAGS: Record<RevalidationEvent, string[]> = {
  [E.PRODUCT_CREATED]: ["products"],
  [E.PRODUCT_UPDATED]: ["products"],
  [E.PRODUCT_DELETED]: ["products"],
  [E.VARIANT_CREATED]: ["products"],
  [E.VARIANT_UPDATED]: ["products"],
  [E.VARIANT_DELETED]: ["products"],
  [E.CATEGORY_CREATED]: ["categories", "products"],
  [E.CATEGORY_UPDATED]: ["categories", "products"],
  [E.CATEGORY_DELETED]: ["categories", "products"],
  [E.REGION_CREATED]: ["regions"],
  [E.REGION_UPDATED]: ["regions"],
  [E.REGION_DELETED]: ["regions"],
  [E.CATERING_INFO_CREATED]: ["products"],
  [E.CATERING_INFO_UPDATED]: ["products"],
  [E.CATERING_INFO_DELETED]: ["products"],
}

const HANDLE_PATTERN = /^[a-z0-9-]+$/
export const MAX_TAGS = 50
export const REQUEST_TIMEOUT_MS = 5_000
export const BATCH_DELAY_MS = 1_000

/**
 * Pure mapping: tags for an event, given the product handles it touched.
 * A handle that does not satisfy the contract's pattern is dropped; the
 * "products" tag that always accompanies it still covers that page.
 */
export function tagsForEvent(
  eventName: string,
  handles: string[] = []
): string[] {
  const base = STATIC_TAGS[eventName as RevalidationEvent]
  if (!base) {
    return []
  }
  const productTags = HANDLE_SOURCES[eventName as RevalidationEvent]
    ? handles.filter((h) => HANDLE_PATTERN.test(h)).map((h) => `product:${h}`)
    : []
  return dedupeTags([...base, ...productTags])
}

/**
 * Unique tags, at most MAX_TAGS. Over the limit, per-product tags are
 * dropped: "products" already invalidates every product page.
 */
export function dedupeTags(tags: string[]): string[] {
  const unique = [...new Set(tags)]
  if (unique.length <= MAX_TAGS) {
    return unique
  }
  const broad = unique.filter((t) => !t.startsWith("product:"))
  return broad.includes("products") ? broad : [...broad, "products"]
}

/** Event payloads carry `id` as a string, or an array for module events. */
export function idsFromEventData(data: unknown): string[] {
  const id = (data as { id?: unknown } | undefined)?.id
  const ids = Array.isArray(id) ? id : [id]
  return ids.filter((v): v is string => typeof v === "string" && v !== "")
}

type GraphQuery = {
  graph: (config: {
    entity: string
    fields: string[]
    filters: Record<string, unknown>
  }) => Promise<{ data: unknown[] }>
}

/**
 * Product handles for the given ids. Soft-deleted rows and unlinked catering
 * info resolve to nothing, which leaves only the event's broad tags.
 */
export async function resolveHandles(
  query: GraphQuery,
  source: HandleSource,
  ids: string[]
): Promise<string[]> {
  if (!ids.length) {
    return []
  }
  const { data } = await query.graph({
    entity: source,
    fields: source === "product" ? ["handle"] : ["product.handle"],
    filters: { id: ids },
  })
  return data
    .map((row) => {
      const r = row as { handle?: string; product?: { handle?: string } }
      return source === "product" ? r.handle : r.product?.handle
    })
    .filter((h): h is string => !!h)
}

export async function resolveTags(
  query: GraphQuery,
  eventName: string,
  data: unknown
): Promise<string[]> {
  const source = HANDLE_SOURCES[eventName as RevalidationEvent]
  const handles = source
    ? await resolveHandles(query, source, idsFromEventData(data))
    : []
  return tagsForEvent(eventName, handles)
}

type RevalidateOptions = {
  logger: Pick<Logger, "info" | "warn">
  fetchImpl?: typeof fetch
  env?: NodeJS.ProcessEnv
}

/**
 * POSTs the tags to the storefront. Never throws: a failure must not affect
 * the Admin operation that caused it, so it is only logged.
 */
export async function revalidateStorefront(
  tags: string[],
  { logger, fetchImpl = fetch, env = process.env }: RevalidateOptions
): Promise<boolean> {
  const unique = dedupeTags(tags)
  if (!unique.length) {
    return false
  }

  const url = env.CATERING_REVALIDATE_URL
  const secret = env.CATERING_REVALIDATE_SECRET
  if (!url || !secret) {
    logger.info(
      `Storefront revalidation skipped (CATERING_REVALIDATE_URL or CATERING_REVALIDATE_SECRET not set): ${unique.join(", ")}`
    )
    return false
  }

  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ tags: unique }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) {
      logger.warn(
        `Storefront revalidation failed: HTTP ${res.status} for ${unique.join(", ")}`
      )
      return false
    }
    logger.info(`Storefront revalidated: ${unique.join(", ")}`)
    return true
  } catch (e) {
    logger.warn(
      `Storefront revalidation failed: ${(e as Error).message} for ${unique.join(", ")}`
    )
    return false
  }
}

/**
 * Collects tags from events arriving within BATCH_DELAY_MS into one call, so
 * a bulk change (e.g. a product edit that also emits variant events, or an
 * import) does not send one request per event. In-process only: tags still
 * pending when the process exits are lost and fall back to the storefront's
 * 1 h revalidation.
 */
export function createRevalidationQueue(
  options: RevalidateOptions & { delayMs?: number }
) {
  const { delayMs = BATCH_DELAY_MS, ...revalidateOptions } = options
  let pending = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = async () => {
    timer = undefined
    const tags = [...pending]
    pending = new Set()
    await revalidateStorefront(tags, revalidateOptions)
  }

  return {
    add(tags: string[]) {
      tags.forEach((t) => pending.add(t))
      if (!timer && pending.size) {
        timer = setTimeout(() => void flush(), delayMs)
      }
    },
    flush,
  }
}
