/**
 * Polish postal codes as delivery zones use them: full codes `XX-XXX` only
 * (specs/007-delivery-zones clarification 2026-10-27). The storefront
 * validates the format; the backend only trims whitespace and never guesses
 * a dash.
 */
const POSTAL_CODE = /^\d{2}-\d{3}$/

/** The trimmed code when it is a full `XX-XXX` code, otherwise null. */
export function parsePostalCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const code = value.trim()
  return POSTAL_CODE.test(code) ? code : null
}

export function isValidPostalCode(value: unknown): boolean {
  return parsePostalCode(value) !== null
}

/**
 * Splits a list pasted by staff (commas, spaces, semicolons, new lines) into
 * unique valid codes, in input order, and the invalid entries as typed.
 */
export function parsePostalCodeList(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = []
  const invalid: string[] = []
  for (const entry of text.split(/[\s,;]+/).filter(Boolean)) {
    const code = parsePostalCode(entry)
    if (!code) {
      if (!invalid.includes(entry)) {
        invalid.push(entry)
      }
    } else if (!valid.includes(code)) {
      valid.push(code)
    }
  }
  return { valid, invalid }
}
