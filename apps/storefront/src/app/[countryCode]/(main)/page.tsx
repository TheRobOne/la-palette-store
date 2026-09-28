import { Metadata } from "next"

import BrandHero from "@modules/home/components/brand-hero"
import CateringProductGrid from "@modules/home/components/catering-product-grid"
import { sdk } from "@lib/config"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: "La Palette Store — Catering na imprezy",
  description:
    "Sklep internetowy kateringu La Palette Garden: finger food, desery i zestawy na Twoją okazję.",
}

const PRODUCT_FIELDS =
  "id,title,handle,thumbnail,*variants.calculated_price,+catering_info.*"

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const region = await getRegion(countryCode)

  if (!region) {
    return (
      <>
        <BrandHero />
      </>
    )
  }

  const { products } = await sdk.client.fetch<{ products: unknown[] }>(
    "/store/products",
    {
      method: "GET",
      query: {
        fields: PRODUCT_FIELDS,
        region_id: region.id,
        limit: 24,
      },
      next: { revalidate: 30 },
      cache: "force-cache",
      // Edge case (spec): a hanging backend must not hang the page —
      // error.tsx shows the "Sklep jest chwilowo niedostępny" state.
      signal: AbortSignal.timeout(5000),
    }
  )

  return (
    <>
      <BrandHero />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <CateringProductGrid products={products as any} />
    </>
  )
}
