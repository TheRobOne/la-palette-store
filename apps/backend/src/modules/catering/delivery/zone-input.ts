import { classifyPostalCodes } from "./postal-code"

/**
 * Validation of a zone saved by staff (specs/007-delivery-zones
 * contracts/admin-api.md): pure, so every message has a unit test. Returns
 * the first problem as a Polish message, or the cleaned codes.
 */

export type ZoneInput = { id?: string; name: string; postal_codes: string[] }
export type OtherZone = { id: string; name: string; codes: string[] }

export type ZoneValidation = { ok: true; codes: string[] } | { ok: false; message: string }

export function validateZoneInput(input: ZoneInput, zones: OtherZone[]): ZoneValidation {
  const others = zones.filter((zone) => zone.id !== input.id)
  const name = input.name.trim()
  if (others.some((zone) => zone.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: `Strefa o nazwie „${name}” już istnieje.` }
  }

  const { valid: codes, invalid } = classifyPostalCodes(input.postal_codes)
  if (invalid.length) {
    return {
      ok: false,
      message: `Nieprawidłowe kody pocztowe: ${invalid.join(", ")}. Użyj formatu XX-XXX.`,
    }
  }
  if (!codes.length) {
    return { ok: false, message: "Podaj co najmniej jeden kod pocztowy." }
  }

  const taken = others
    .map((zone) => ({ zone, codes: codes.filter((code) => zone.codes.includes(code)) }))
    .filter((t) => t.codes.length)
  if (taken.length) {
    return {
      ok: false,
      message: taken
        .map(({ zone, codes }) =>
          codes.length === 1
            ? `Kod ${codes[0]} jest już w strefie „${zone.name}”.`
            : `Kody ${codes.join(", ")} są już w strefie „${zone.name}”.`
        )
        .join(" "),
    }
  }

  return { ok: true, codes: [...codes].sort() }
}
