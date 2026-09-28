import { Metadata } from "next"
import { pl } from "../../../../i18n/pl"

export const metadata: Metadata = {
  title: pl.legal.termsTitle,
}

export default function RegulaminPage() {
  return (
    <div className="content-container py-24 text-center">
      <h1 className="font-serif text-3xl text-brown-black">
        {pl.legal.termsTitle}
      </h1>
      <p className="mt-4 text-brown-light">{pl.legal.placeholder}</p>
    </div>
  )
}
