import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { pl } from "../../../../i18n/pl"

/**
 * Brand header (spec US3): logo + navigation placeholders. Cart and account
 * links are intentionally omitted until their features ship (constitution
 * III: brand tokens only, no hard-coded values; spec Assumptions).
 */
export default function Nav() {
  return (
    <div className="sticky top-0 inset-x-0 z-50 bg-beige-light border-b border-separator">
      <header className="content-container flex items-center justify-between h-16 small:h-20">
        <LocalizedClientLink
          href="/"
          className="flex items-center gap-2"
          data-testid="nav-store-link"
        >
          <Image
            src="/brand/logo-small.svg"
            alt={pl.brand.name}
            width={36}
            height={36}
            priority
          />
          <span className="font-serif text-lg text-brown-black hidden small:inline">
            {pl.brand.name}
          </span>
        </LocalizedClientLink>

        <nav className="hidden small:flex items-center gap-8 text-base-regular text-brown-black">
          <LocalizedClientLink href="/">{pl.nav.home}</LocalizedClientLink>
          <span className="text-brown-light cursor-default">{pl.nav.menu}</span>
          <span className="text-brown-light cursor-default">{pl.nav.contact}</span>
        </nav>
      </header>
    </div>
  )
}
