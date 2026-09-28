"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions("regions")),
  }

  return await sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ regions }) => regions)
}

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(["regions", id].join("-"))),
  }

  return await sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
}

const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "pl"

let cachedRegion: HttpTypes.StoreRegion | null = null

/**
 * Resolves the store's single configured region (Poland/PLN — see
 * NEXT_PUBLIC_DEFAULT_REGION). The store is single-market, so there is no
 * country-code argument (feature 002-remove-locale-prefix).
 */
export const getRegion = async () => {
  if (cachedRegion) {
    return cachedRegion
  }

  const regions = await listRegions()

  if (!regions?.length) {
    return null
  }

  const matched = regions.find((region) =>
    region.countries?.some((c) => c?.iso_2 === DEFAULT_REGION)
  )

  cachedRegion = matched ?? regions[0]

  return cachedRegion
}
