import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Instrument_Serif } from "next/font/google"
import localFont from "next/font/local"
import "../styles/globals.css"

// Brand fonts (research R-08 / spec FR-006): Instrument Serif for headings,
// Switzer for body text — copied from the la-palette-garden brand repo.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
})

const switzer = localFont({
  src: [
    { path: "../fonts/switzer/Switzer-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/switzer/Switzer-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/switzer/Switzer-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/switzer/Switzer-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-switzer",
  display: "swap",
})

const allowIndexing = process.env.ALLOW_INDEXING === "true"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  robots: allowIndexing
    ? undefined
    : { index: false, follow: false, nocache: true },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html
      lang="pl"
      data-mode="light"
      className={`${instrumentSerif.variable} ${switzer.variable}`}
    >
      <body className="bg-beige-light font-sans text-brown-black">
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
