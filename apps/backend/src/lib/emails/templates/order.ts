import { formatDate, formatWindow } from "../format"
import {
  type Block,
  contactBlock,
  deliveryOf,
  field,
  heading,
  link,
  orderSummary,
  paragraph,
  render,
  zoneBlock,
} from "../layout"
import type { OrderEmailData, RenderedEmail } from "../types"

const invoiceBlocks = (data: OrderEmailData): Block[] =>
  data.invoice
    ? [
        heading("Faktura"),
        field("Firma:", data.invoice.company),
        field("NIP:", data.invoice.nip),
        field("Adres:", data.invoice.address),
      ]
    : []

const notesBlocks = (notes: string | null): Block[] =>
  notes ? [heading("Uwagi do zamówienia"), paragraph(notes)] : []

/**
 * Order confirmation — the confirmation of the distance contract on a durable
 * medium (spec FR-001, Polish consumer law): order number, term, pickup
 * address (or delivery address and cost, spec 007), items, total, invoice
 * data, notes and the terms of service.
 */
export function orderConfirmation(data: OrderEmailData): RenderedEmail {
  return render(`Potwierdzenie zamówienia nr ${data.display_id}`, [
    paragraph(
      `Dziękujemy! Zamówienie nr ${data.display_id} jest przyjęte i opłacone. ` +
        (deliveryOf(data)
          ? "Dowieziemy je pod wskazany adres w wybranym terminie."
          : "Czekamy na Ciebie w wybranym terminie odbioru.")
    ),
    ...orderSummary(data),
    ...invoiceBlocks(data),
    ...notesBlocks(data.notes),
    paragraph(
      "Zachowaj tę wiadomość — to potwierdzenie zawarcia umowy. Zamówienie realizujemy " +
        "zgodnie z regulaminem sklepu. Żywność przygotowywana na wskazany termin nie podlega " +
        "zwrotowi (art. 38 pkt 4 ustawy o prawach konsumenta)."
    ),
    link("Regulamin sklepu", data.links.terms),
    contactBlock(data.pickup_address),
  ])
}

/** Staff: a new paid order (spec FR-003). */
export function staffNewOrder(data: OrderEmailData): RenderedEmail {
  const delivery = deliveryOf(data)
  return render(
    `Nowe zamówienie nr ${data.display_id} — ${delivery ? "dostawa" : "odbiór"} ${formatDate(data.term.date)} ${formatWindow(data.term.start, data.term.end)}`,
    [
      paragraph(`Nowe opłacone zamówienie nr ${data.display_id}.`),
      ...orderSummary(data),
      ...(delivery ? [zoneBlock(delivery)] : []),
      heading("Klient"),
      field("Imię i nazwisko:", data.contact.name ?? "—"),
      field("E-mail:", data.contact.email ?? "—"),
      field("Telefon:", data.contact.phone ?? "—"),
      field("Faktura:", data.invoice ? `tak — ${data.invoice.company}, NIP ${data.invoice.nip}` : "nie"),
      ...notesBlocks(data.notes),
      link("Otwórz zamówienie w panelu", data.links.admin),
    ]
  )
}
