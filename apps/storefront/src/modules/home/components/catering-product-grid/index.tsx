import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { pl } from "../../../../i18n/pl"

type CateringInfo = {
  min_quantity: number
  pricing_unit: "piece" | "portion" | "person"
}

type Product = {
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
  catering_product_info?: CateringInfo | null
}

/**
 * Storefront home product grid (spec FR-005, contracts/http-api.md).
 * Shows name, image and gross PLN price for every seeded product.
 */
export default function CateringProductGrid({
  products,
}: {
  products: Product[]
}) {
  if (products.length === 0) {
    return null
  }

  return (
    <section className="content-container py-12">
      <h2 className="font-serif text-3xl text-brown-black mb-8">
        {pl.products.heading}
      </h2>
      <ul className="grid grid-cols-2 small:grid-cols-3 gap-x-4 gap-y-8">
        {products.map((product) => {
          const price = product.variants?.[0]?.calculated_price
          const catering = product.catering_product_info

          return (
            <li key={product.id}>
              <LocalizedClientLink
                href={`/products/${product.handle}`}
                className="group block"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-large bg-beige-dark">
                  {product.thumbnail && (
                    <Image
                      src={product.thumbnail}
                      alt={product.title}
                      fill
                      sizes="(max-width: 576px) 50vw, 33vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="mt-3 flex flex-col gap-1">
                  <span className="text-base-semi text-brown-black">
                    {product.title}
                  </span>
                  {catering && (
                    <span className="text-small-regular text-brown-light">
                      {pl.products.minQuantity(catering.min_quantity)} ·{" "}
                      {pl.products.pricingUnit[catering.pricing_unit]}
                    </span>
                  )}
                  {price?.calculated_amount != null && (
                    <span className="text-base-semi text-brown-button">
                      {pl.products.from}{" "}
                      {convertToLocale({
                        amount: price.calculated_amount,
                        currency_code: price.currency_code,
                        locale: "pl-PL",
                      })}
                    </span>
                  )}
                </div>
              </LocalizedClientLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
