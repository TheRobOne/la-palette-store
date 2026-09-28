import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { pl } from "../../../../i18n/pl"

/**
 * Brand footer (spec US3, FR-006): company details and legal links.
 */
export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-separator bg-beige-light">
      <div className="content-container flex flex-col gap-6 py-12 small:flex-row small:justify-between">
        <div>
          <span className="font-serif text-xl text-brown-black">
            {pl.footer.company}
          </span>
          <p className="text-small-regular text-brown-light mt-1">
            {pl.footer.addressLine}
          </p>
        </div>
        <div>
          <span className="text-small-semi text-brown-black">
            {pl.footer.legal}
          </span>
          <ul className="mt-2 flex flex-col gap-1 text-small-regular text-brown-light">
            <li>
              <LocalizedClientLink href="/regulamin">
                {pl.footer.terms}
              </LocalizedClientLink>
            </li>
            <li>
              <LocalizedClientLink href="/polityka-prywatnosci">
                {pl.footer.privacy}
              </LocalizedClientLink>
            </li>
          </ul>
        </div>
      </div>
      <div className="content-container border-t border-separator py-4">
        <p className="text-xsmall-regular text-brown-light">
          {pl.footer.rights(year)}
        </p>
      </div>
    </footer>
  )
}
