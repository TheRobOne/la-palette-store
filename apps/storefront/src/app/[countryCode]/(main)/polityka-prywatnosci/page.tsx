import { Metadata } from "next"
import { pl } from "../../../../i18n/pl"

export const metadata: Metadata = {
  title: pl.legal.privacyTitle,
}

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="content-container py-24 text-center">
      <h1 className="font-serif text-3xl text-brown-black">
        {pl.legal.privacyTitle}
      </h1>
      <p className="mt-4 text-brown-light">{pl.legal.placeholder}</p>
    </div>
  )
}
