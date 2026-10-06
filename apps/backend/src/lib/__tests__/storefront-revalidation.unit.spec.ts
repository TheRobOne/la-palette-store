import {
  createRevalidationQueue,
  dedupeTags,
  idsFromEventData,
  MAX_TAGS,
  resolveTags,
  revalidateStorefront,
  tagsForEvent,
} from "../storefront-revalidation"

const env = {
  CATERING_REVALIDATE_URL: "https://storefront.test/api/catering/revalidate",
  CATERING_REVALIDATE_SECRET: "test-secret",
}

const makeLogger = () => ({ info: jest.fn(), warn: jest.fn() })

const okFetch = () =>
  jest.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as jest.Mock &
    typeof fetch

describe("tagsForEvent (unit, no database)", () => {
  it.each([
    ["product.created", ["products", "product:wloski"]],
    ["product.updated", ["products", "product:wloski"]],
    ["product-variant.updated", ["products", "product:wloski"]],
    ["catering.catering-product-info.updated", ["products", "product:wloski"]],
  ])("maps %s to the product tags", (event, expected) => {
    expect(tagsForEvent(event, ["wloski"])).toEqual(expected)
  })

  it("maps product.deleted to products only", () => {
    expect(tagsForEvent("product.deleted", ["wloski"])).toEqual(["products"])
  })

  it.each([
    "product-category.created",
    "product-category.updated",
    "product-category.deleted",
  ])("maps %s to categories and products", (event) => {
    expect(tagsForEvent(event)).toEqual(["categories", "products"])
  })

  it("maps region events to regions", () => {
    expect(tagsForEvent("region.updated")).toEqual(["regions"])
  })

  it("falls back to products when no handle was found", () => {
    expect(tagsForEvent("product-variant.updated", [])).toEqual(["products"])
  })

  it("drops handles that break the contract pattern", () => {
    expect(tagsForEvent("product.updated", ["Złe Handle", "ok-1"])).toEqual([
      "products",
      "product:ok-1",
    ])
  })

  it("ignores unknown events", () => {
    expect(tagsForEvent("order.placed", ["x"])).toEqual([])
  })
})

describe("dedupeTags", () => {
  it("removes duplicates", () => {
    expect(dedupeTags(["products", "product:a", "products"])).toEqual([
      "products",
      "product:a",
    ])
  })

  it("collapses per-product tags over the limit", () => {
    const many = Array.from({ length: MAX_TAGS }, (_, i) => `product:p${i}`)
    expect(dedupeTags(["categories", ...many])).toEqual([
      "categories",
      "products",
    ])
  })
})

describe("idsFromEventData", () => {
  it("accepts a single id or an array of ids", () => {
    expect(idsFromEventData({ id: "a" })).toEqual(["a"])
    expect(idsFromEventData({ id: ["a", "b"] })).toEqual(["a", "b"])
    expect(idsFromEventData(undefined)).toEqual([])
  })
})

describe("resolveTags", () => {
  it("looks up product handles through query.graph", async () => {
    const query = {
      graph: jest
        .fn()
        .mockResolvedValue({ data: [{ product: { handle: "wloski" } }] }),
    }
    const tags = await resolveTags(query, "product-variant.updated", {
      id: "variant_1",
    })
    expect(query.graph).toHaveBeenCalledWith({
      entity: "product_variant",
      fields: ["product.handle"],
      filters: { id: ["variant_1"] },
    })
    expect(tags).toEqual(["products", "product:wloski"])
  })

  it("does not query for events that need no handle", async () => {
    const query = { graph: jest.fn() }
    expect(await resolveTags(query, "product.deleted", { id: "p" })).toEqual([
      "products",
    ])
    expect(query.graph).not.toHaveBeenCalled()
  })
})

describe("revalidateStorefront", () => {
  it("POSTs deduplicated tags with the secret header", async () => {
    const fetchImpl = okFetch()
    const logger = makeLogger()
    const ok = await revalidateStorefront(
      ["products", "product:wloski", "products"],
      { logger, fetchImpl, env }
    )
    expect(ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(env.CATERING_REVALIDATE_URL)
    expect(init.method).toBe("POST")
    expect(init.headers["x-revalidate-secret"]).toBe("test-secret")
    expect(JSON.parse(init.body)).toEqual({
      tags: ["products", "product:wloski"],
    })
    expect(init.signal).toBeDefined()
  })

  it("skips with one info log when env is missing", async () => {
    const fetchImpl = okFetch()
    const logger = makeLogger()
    const ok = await revalidateStorefront(["products"], {
      logger,
      fetchImpl,
      env: {},
    })
    expect(ok).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledTimes(1)
  })

  it("logs and does not throw on a network error", async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValue(new Error("timeout")) as unknown as typeof fetch
    const logger = makeLogger()
    await expect(
      revalidateStorefront(["products"], { logger, fetchImpl, env })
    ).resolves.toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("timeout"))
  })

  it("logs and does not throw on a non-2xx response", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch
    const logger = makeLogger()
    await expect(
      revalidateStorefront(["products"], { logger, fetchImpl, env })
    ).resolves.toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("401"))
  })

  it("never logs the secret", async () => {
    const logger = makeLogger()
    await revalidateStorefront(["products"], {
      logger,
      fetchImpl: okFetch(),
      env,
    })
    const logged = JSON.stringify([
      logger.info.mock.calls,
      logger.warn.mock.calls,
    ])
    expect(logged).not.toContain("test-secret")
  })
})

describe("createRevalidationQueue", () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it("batches tags from several events into one request", async () => {
    const fetchImpl = okFetch()
    const queue = createRevalidationQueue({
      logger: makeLogger(),
      fetchImpl,
      env,
      delayMs: 1000,
    })
    queue.add(["products", "product:a"])
    queue.add(["products", "product:b"])
    queue.add(["categories", "products"])
    expect(fetchImpl).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(1000)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      tags: ["products", "product:a", "product:b", "categories"],
    })
  })

  it("does not send anything for events without tags", async () => {
    const fetchImpl = okFetch()
    const queue = createRevalidationQueue({
      logger: makeLogger(),
      fetchImpl,
      env,
    })
    queue.add([])
    await jest.advanceTimersByTimeAsync(5000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
