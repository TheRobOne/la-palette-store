import { escapeHtml, formatAmount, formatDate, formatWindow } from "./format"
import type {
  EmailAddress,
  EmailFulfillment,
  EmailItem,
  EmailOrderData,
  EmailTerm,
  RenderedEmail,
} from "./types"

/**
 * Shared e-mail layout: one column, table-based HTML with inline styles (the
 * only styling e-mail clients support) plus a plain-text part.
 *
 * Brand values copied from la-palette-garden `src/app/globals.css`
 * (--color-beige-light, --color-brown-dark, --color-brown-button,
 * --color-beige-dark) — e-mail clients ignore CSS variables, see
 * specs/006-transactional-emails/plan.md "Complexity Tracking".
 */
const BRAND = {
  background: "#faf7f2",
  text: "#3f3232",
  button: "#6f5141",
  border: "#ded6cf",
}
const LOGO_URL = "https://www.lapalettegarden.pl/logo-full-kolor.png"
const FONT = "Georgia, 'Times New Roman', serif"

/** One block of the e-mail: html and its plain-text counterpart. */
export type Block = { html: string; text: string }

export const paragraph = (text: string): Block => ({
  html: `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(text)}</p>`,
  text,
})

/** A paragraph with a bold lead, e.g. "Termin odbioru:" + value. */
export const field = (label: string, value: string): Block => ({
  html: `<p style="margin:0 0 8px;line-height:1.5"><strong>${escapeHtml(label)}</strong> ${escapeHtml(value)}</p>`,
  text: `${label} ${value}`,
})

export const button = (label: string, url: string): Block => ({
  html:
    `<p style="margin:24px 0"><a href="${escapeHtml(url)}" ` +
    `style="background:${BRAND.button};color:#ffffff;padding:12px 24px;border-radius:4px;` +
    `text-decoration:none;display:inline-block;font-weight:bold">${escapeHtml(label)}</a></p>`,
  text: `${label}: ${url}`,
})

export const link = (label: string, url: string): Block => ({
  html: `<p style="margin:0 0 16px"><a href="${escapeHtml(url)}" style="color:${BRAND.button}">${escapeHtml(label)}</a></p>`,
  text: `${label}: ${url}`,
})

export const heading = (text: string): Block => ({
  html: `<h2 style="margin:24px 0 12px;font-size:18px;font-weight:normal">${escapeHtml(text)}</h2>`,
  text: `\n${text.toUpperCase()}`,
})

export type DeliveryFulfillment = Extract<EmailFulfillment, { method: "delivery" }>

/** The delivery details of an order/request, or null for pickup (also old data without them). */
export const deliveryOf = (data: EmailOrderData): DeliveryFulfillment | null =>
  data.fulfillment?.method === "delivery" ? data.fulfillment : null

export const termBlock = (term: EmailTerm, label = "Termin odbioru:"): Block =>
  field(label, `${formatDate(term.date)}, ${formatWindow(term.start, term.end)}`)

export const deliveryTermBlock = (term: EmailTerm): Block => termBlock(term, "Dostawa:")

export const addressBlock = (address: EmailAddress): Block =>
  field(
    "Adres odbioru:",
    `La Palette Garden, ${address.address_1}, ${address.postal_code} ${address.city}`
  )

export const formatDeliveryAddress = (address: EmailAddress) =>
  `${address.address_1}, ${address.postal_code} ${address.city}`

/** Delivery address and the phone the driver calls (spec 007). */
export const deliveryAddressBlocks = (delivery: DeliveryFulfillment): Block[] => [
  field("Adres dostawy:", formatDeliveryAddress(delivery.address)),
  ...(delivery.address.phone ? [field("Telefon:", delivery.address.phone)] : []),
]

/**
 * Items with quantities and gross line totals, then the total. With a
 * delivery (`deliveryCost` not undefined) a "Dostawa" line comes before the
 * total, which then includes it; a cost not set yet (out of zone, null) is
 * shown as pending and the total is the products only.
 */
export function itemsBlock(
  items: EmailItem[],
  total: number,
  deliveryCost?: number | null
): Block {
  const name = (i: EmailItem) => (i.variant_title ? `${i.title} (${i.variant_title})` : i.title)
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid ${BRAND.border}">${escapeHtml(name(i))}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid ${BRAND.border};white-space:nowrap">× ${i.quantity}</td>` +
        `<td style="padding:6px 0;border-bottom:1px solid ${BRAND.border};text-align:right;white-space:nowrap">${escapeHtml(formatAmount(i.total))}</td></tr>`
    )
    .join("")
  const delivery =
    deliveryCost === undefined
      ? null
      : deliveryCost === null
        ? "do potwierdzenia przez kuchnię"
        : deliveryCost === 0
          ? "gratis"
          : formatAmount(deliveryCost)
  const sum = total + (deliveryCost ?? 0)
  const totalLabel = deliveryCost === null ? "Razem (bez dostawy)" : "Razem"
  return {
    html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">` +
      rows +
      (delivery
        ? `<tr><td style="padding:6px 0;border-bottom:1px solid ${BRAND.border}" colspan="2">Dostawa</td>` +
          `<td style="padding:6px 0;border-bottom:1px solid ${BRAND.border};text-align:right;white-space:nowrap">${escapeHtml(delivery)}</td></tr>`
        : "") +
      `<tr><td style="padding:8px 0" colspan="2"><strong>${totalLabel}</strong></td>` +
      `<td style="padding:8px 0;text-align:right;white-space:nowrap"><strong>${escapeHtml(formatAmount(sum))}</strong></td></tr></table>`,
    text:
      items.map((i) => `- ${name(i)} × ${i.quantity}: ${formatAmount(i.total)}`).join("\n") +
      (delivery ? `\nDostawa: ${delivery}` : "") +
      `\n${totalLabel}: ${formatAmount(sum)}`,
  }
}

/**
 * Term, pickup address, items — the core of every order/request e-mail; for
 * a delivery: window, delivery address and phone, items with the delivery cost.
 */
export const orderSummary = (data: EmailOrderData): Block[] => {
  const delivery = deliveryOf(data)
  if (delivery) {
    return [
      deliveryTermBlock(data.term),
      ...deliveryAddressBlocks(delivery),
      heading("Produkty"),
      itemsBlock(data.items, data.total, delivery.delivery_cost),
    ]
  }
  return [
    termBlock(data.term),
    addressBlock(data.pickup_address),
    heading("Produkty"),
    itemsBlock(data.items, data.total),
  ]
}

/** Staff: the zone, or the reminder to set a cost for an out-of-zone delivery. */
export const zoneBlock = (delivery: DeliveryFulfillment, outOfZoneNote = "poza strefą"): Block =>
  field("Strefa:", delivery.out_of_zone ? outOfZoneNote : (delivery.zone_name ?? "—"))

/** Contact footer line used in customer e-mails. */
export const contactBlock = (address: EmailAddress): Block =>
  paragraph(
    `Pytania? Odpowiedz na tę wiadomość${address.phone ? ` albo zadzwoń: ${address.phone}` : ""}.`
  )

/** Wraps blocks into the full e-mail (html + text). */
export function render(subject: string, blocks: Block[]): RenderedEmail {
  const body = blocks.map((b) => b.html).join("\n")
  const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.background}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${BRAND.border}">
<tr><td style="padding:24px;text-align:center;border-bottom:1px solid ${BRAND.border}"><img src="${LOGO_URL}" alt="La Palette Garden" width="180" style="max-width:180px;height:auto;border:0"></td></tr>
<tr><td style="padding:24px;font-family:${FONT};font-size:16px;color:${BRAND.text}">
${body}
</td></tr>
<tr><td style="padding:16px 24px;font-family:${FONT};font-size:12px;color:${BRAND.text};border-top:1px solid ${BRAND.border}">La Palette Garden · catering · lapalettegarden.pl</td></tr>
</table></td></tr></table>
</body></html>`
  const text = `${blocks.map((b) => b.text).join("\n\n")}\n\n—\nLa Palette Garden · lapalettegarden.pl\n`
  return { subject, html, text }
}
