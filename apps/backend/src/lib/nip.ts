/**
 * Polish tax identification number (NIP). Dependency-free on purpose:
 * shared by the server (src/lib/invoice.ts) and the Admin widget bundle.
 *
 * A NIP has 10 digits; the last one is a checksum: the first nine digits
 * multiplied by the weights below, summed, modulo 11 (a result of 10 can
 * never match a single digit, so such numbers are invalid).
 */
const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7]

/**
 * Strips what customers commonly type around a NIP: spaces, dashes, dots
 * and an optional "PL" prefix (EU VAT format). A well-formed NIP comes back
 * as 10 bare digits; anything else keeps its remaining characters.
 */
export function normalizeNip(input: string): string {
  const compact = input.replace(/[\s.-]/g, "")
  return compact.replace(/^PL/i, "")
}

export function isValidNip(input: string | null | undefined): boolean {
  if (typeof input !== "string") {
    return false
  }

  const nip = normalizeNip(input)
  if (!/^\d{10}$/.test(nip) || /^0+$/.test(nip)) {
    return false
  }

  const digits = nip.split("").map(Number)
  const checksum =
    WEIGHTS.reduce((sum, weight, i) => sum + weight * digits[i], 0) % 11

  return checksum === digits[9]
}

/** "123-456-32-18" — the common Polish display format. */
export function formatNip(input: string): string {
  const nip = normalizeNip(input)
  return /^\d{10}$/.test(nip)
    ? `${nip.slice(0, 3)}-${nip.slice(3, 6)}-${nip.slice(6, 8)}-${nip.slice(8)}`
    : input
}
