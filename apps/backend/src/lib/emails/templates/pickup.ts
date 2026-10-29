import { formatDate, formatWindow } from "../format"
import {
  addressBlock,
  button,
  contactBlock,
  deliveryAddressBlocks,
  deliveryOf,
  deliveryTermBlock,
  field,
  heading,
  itemsBlock,
  link,
  paragraph,
  render,
  termBlock,
} from "../layout"
import type { OrderEmailData, RenderedEmail, RescheduledEmailData } from "../types"

/**
 * Pickup changes and reminders (spec 006 US4, US5; contracts/emails.md);
 * delivery wording and address for delivery orders (spec 007).
 */

const termText = (term: { date: string; start: string; end: string }) =>
  `${formatDate(term.date)}, ${formatWindow(term.start, term.end)}`

const mapUrl = (data: OrderEmailData) =>
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent(
    `La Palette Garden, ${data.pickup_address.address_1}, ${data.pickup_address.postal_code} ${data.pickup_address.city}`
  )

/** Staff moved the pickup term of an order or of a not-yet-paid request. */
export function pickupRescheduled(data: RescheduledEmailData): RenderedEmail {
  const isOrder = "display_id" in data
  const delivery = deliveryOf(data)
  const what = delivery ? "termin dostawy" : "termin odbioru"
  return render(`Zmiana terminu ${delivery ? "dostawy" : "odbioru"}: ${formatDate(data.term.date)}`, [
    paragraph(
      isOrder
        ? `Zmieniliśmy ${what} zamówienia nr ${data.display_id}.`
        : `Zmieniliśmy ${what} w Twoim zapytaniu.`
    ),
    field("Poprzedni termin:", termText(data.previous_term)),
    field("Nowy termin:", termText(data.term)),
    ...(delivery ? deliveryAddressBlocks(delivery) : [addressBlock(data.pickup_address)]),
    paragraph("Jeśli nowy termin Ci nie odpowiada, odpowiedz na tę wiadomość albo zadzwoń."),
    ...(!isOrder && data.links.request_status
      ? [link("Sprawdź status zapytania", data.links.request_status)]
      : []),
    contactBlock(data.pickup_address),
  ])
}

/**
 * Staff cancelled an order. The refund sentence is to be confirmed with the
 * manager before go-live (tasks T040).
 */
export function orderCanceled(data: OrderEmailData): RenderedEmail {
  return render(`Zamówienie nr ${data.display_id} zostało anulowane`, [
    paragraph(
      `Zamówienie nr ${data.display_id} ${deliveryOf(data) ? "z dostawą " : ""}na ${termText(data.term)} zostało anulowane.`
    ),
    paragraph(
      "Jeśli zamówienie było opłacone, zwrócimy pieniądze tą samą metodą płatności, " +
        "najpóźniej w ciągu 14 dni."
    ),
    heading("Anulowane produkty"),
    itemsBlock(data),
    link("Przejdź do sklepu", data.links.shop),
    contactBlock(data.pickup_address),
  ])
}

/** The day before the pickup (US5) or the delivery (spec 007: no map, the driver calls). */
export function pickupReminder(data: OrderEmailData): RenderedEmail {
  const delivery = deliveryOf(data)
  if (delivery) {
    return render(`Jutro dostawa zamówienia nr ${data.display_id}`, [
      paragraph(`Przypominamy: jutro dowozimy zamówienie nr ${data.display_id}.`),
      deliveryTermBlock(data.term),
      ...deliveryAddressBlocks(delivery),
      ...(delivery.address.phone
        ? [paragraph(`Kierowca zadzwoni pod numer ${delivery.address.phone}.`)]
        : []),
      heading("Produkty"),
      itemsBlock(data, delivery.delivery_cost),
      contactBlock(data.pickup_address),
    ])
  }
  return render(`Jutro odbiór zamówienia nr ${data.display_id}`, [
    paragraph(`Przypominamy: jutro odbierasz zamówienie nr ${data.display_id}.`),
    termBlock(data.term),
    addressBlock(data.pickup_address),
    button("Jak dojechać", mapUrl(data)),
    heading("Produkty"),
    itemsBlock(data),
    contactBlock(data.pickup_address),
  ])
}
