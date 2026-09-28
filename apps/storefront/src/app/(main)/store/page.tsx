import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getRegion } from "@lib/data/regions"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Store",
  description: "Explore all of our products.",
}

// Fetches live backend data with no generateStaticParams; now that this
// route no longer sits under a dynamic [countryCode] segment, Next would
// otherwise try to prerender it at build time, where a real backend/key
// isn't available (constitution: CI builds need no database/external
// service) — force it to render per-request instead, like /cart and
// /checkout already do implicitly.
export const dynamic = "force-dynamic"

export default async function StorePage() {
  const region = await getRegion()

  if (!region) {
    notFound()
  }

  return <StoreTemplate currencyCode={region.currency_code} />
}
