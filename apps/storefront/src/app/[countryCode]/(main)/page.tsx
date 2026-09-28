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

const PRODUCT_FIELDS = "id,title,handle,thumbnail,*variants.calculated_price"
// Edge case (spec): a hanging backend must not hang the page — error.tsx
// shows the "Sklep jest chwilowo niedostępny" state.
const FETCH_TIMEOUT_MS = 5000

type StoreProduct = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  variants?: {
    calculated_price?: {
      calculated_amount: number | null
      currency_code: string
    } | null
  }[]
}

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

  const { products } = await sdk.client.fetch<{ products: StoreProduct[] }>(
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
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }
  )

  // Catering attributes (min quantity, pricing unit, allergens...) come from
  // a separate batch endpoint: the built-in /store/products route serves
  // list/retrieve requests from Medusa's index engine, which does not
  // resolve custom module links (see backend
  // src/api/store/catering-info/route.ts for why).
  const productIds = products.map((p) => p.id)
  const { catering_info: cateringInfoById } = productIds.length
    ? await sdk.client.fetch<{
        catering_info: Record<
          string,
          {
            min_quantity: number
            pricing_unit: "piece" | "portion" | "person"
          }
        >
      }>("/store/catering-info", {
        method: "GET",
        query: { product_id: productIds },
        next: { revalidate: 30 },
        cache: "force-cache",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    : { catering_info: {} }

  const productsWithCateringInfo = products.map((product) => ({
    ...product,
    catering_product_info: cateringInfoById[product.id] ?? null,
  }))

  return (
    <>
      <BrandHero />
      <CateringProductGrid products={productsWithCateringInfo} />
    </>
  )
}
