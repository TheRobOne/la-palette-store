"use client" // Error boundaries must be Client Components

import { pl } from "../../i18n/pl"

/**
 * Backend-unavailable state (spec Edge Cases / US1): shown instead of a
 * crash when the backend can't be reached. Header/footer keep rendering
 * because they come from layout.tsx, which this boundary does not replace.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="content-container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="font-serif text-2xl text-brown-black">
        {pl.errors.backendUnavailable}
      </h2>
      <p className="text-brown-light">{pl.errors.backendUnavailableHint}</p>
      <button
        onClick={() => reset()}
        className="contrast-btn text-brown-black border-brown-black"
      >
        {pl.errors.retry}
      </button>
    </div>
  )
}
