import Image from "next/image"
import { pl } from "../../../../i18n/pl"

/**
 * Brand hero (spec US3): image and copy from the La Palette Garden brand
 * repo, styled with the shared theme tokens (Constitution III).
 */
export default function BrandHero() {
  return (
    <div className="relative w-full h-[75vh] min-h-[480px] bg-beige-dark overflow-hidden">
      <Image
        src="/brand/intro2.webp"
        alt=""
        fill
        priority
        className="object-cover hidden small:block"
      />
      <Image
        src="/brand/intro2-mobile.webp"
        alt=""
        fill
        priority
        className="object-cover small:hidden"
      />
      <div className="absolute inset-0 bg-brown-black/30" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-6">
        <h1 className="font-serif text-4xl small:text-6xl text-beige-light">
          {pl.hero.title}
        </h1>
        <p className="mt-4 max-w-xl text-large-regular text-beige-light">
          {pl.hero.subtitle}
        </p>
      </div>
    </div>
  )
}
