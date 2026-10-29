import type { BigNumberInput, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN, MedusaError } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../../modules/catering"
import type CateringModuleService from "../../modules/catering/service"
import { parseTerm } from "../../modules/catering/scheduling/term"
import { DISCOUNT_FIELDS, discountOf, type DiscountSource } from "../discount"
import { INVOICE_NIP_METADATA_KEY, isInvoiceRequested } from "../invoice-metadata"
import { findOrderBooking } from "../order-booking"
import { STOCK_LOCATION_NAME, VENUE_ADDRESS } from "../pickup"
import type {
  EmailAddress,
  EmailContact,
  EmailFulfillment,
  EmailInvoice,
  EmailItem,
  EmailOrderData,
  OrderEmailData,
  RequestEmailData,
} from "./types"

/**
 * Template data for order and request e-mails (spec 006 research R-07). The
 * result is stored on the notification, so a retry renders the same e-mail.
 */

type LineLike = {
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  quantity?: unknown
  total?: unknown
  original_total?: unknown
}

type AddressLike = {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  company?: string | null
  address_1?: string | null
  postal_code?: string | null
  city?: string | null
} | null

type Purchase = DiscountSource & {
  email?: string | null
  metadata?: Record<string, unknown> | null
  billing_address?: AddressLike
  shipping_address?: AddressLike
  items?: (LineLike & NonNullable<DiscountSource["items"]>[number])[] | null
}

type BookingLike = {
  fulfillment_method: string
  delivery_zone_id?: string | null
  delivery_zone_name?: string | null
  delivery_cost?: unknown
} | null | undefined

const PURCHASE_FIELDS = [
  "email",
  ...DISCOUNT_FIELDS,
  "metadata",
  "billing_address.first_name",
  "billing_address.last_name",
  "billing_address.phone",
  "billing_address.company",
  "billing_address.address_1",
  "billing_address.postal_code",
  "billing_address.city",
  "shipping_address.address_1",
  "shipping_address.postal_code",
  "shipping_address.city",
  "shipping_address.phone",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.quantity",
  "items.total",
  "items.original_total",
]

const num = (value: unknown) => Number(value ?? 0)

const trimSlash = (url: string) => url.replace(/\/+$/, "")

export function emailLinks() {
  const shop = trimSlash(process.env.STOREFRONT_URL || "https://lapalettegarden.pl")
  const admin = trimSlash(process.env.MEDUSA_BACKEND_URL || "http://localhost:9000")
  return { shop: `${shop}/catering`, terms: `${shop}/catering/regulamin`, admin: `${admin}/app` }
}

function items(lines: LineLike[] | null | undefined): EmailItem[] {
  return (lines ?? []).map((line) => {
    const title = line.product_title || line.title || "Produkt"
    const variant = line.variant_title && line.variant_title !== title ? line.variant_title : null
    return {
      title,
      // Medusa's single-variant products are called "Default variant"
      variant_title: variant && !/^default/i.test(variant) ? variant : null,
      quantity: num(line.quantity),
      // before discounts: the e-mail shows the discount as its own line
      total: num(line.original_total ?? line.total),
    }
  })
}

function contact(purchase: Purchase): EmailContact {
  const a = purchase.billing_address
  const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ")
  return { name: name || null, email: purchase.email ?? null, phone: a?.phone ?? null }
}

function invoice(purchase: Purchase): EmailInvoice | null {
  if (!isInvoiceRequested(purchase.metadata)) {
    return null
  }
  const a = purchase.billing_address
  return {
    company: a?.company ?? "",
    nip: String(purchase.metadata?.[INVOICE_NIP_METADATA_KEY] ?? ""),
    address: [a?.address_1, [a?.postal_code, a?.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
  }
}

/** Delivery address, zone and cost from the booking and the shipping address (spec 007). */
function fulfillment(purchase: Purchase, booking: BookingLike): EmailFulfillment {
  if (booking?.fulfillment_method !== "delivery") {
    return { method: "pickup" }
  }
  const a = purchase.shipping_address
  return {
    method: "delivery",
    address: {
      address_1: a?.address_1 ?? "",
      postal_code: a?.postal_code ?? "",
      city: a?.city ?? "",
      phone: a?.phone ?? null,
    },
    zone_name: booking.delivery_zone_name ?? null,
    out_of_zone: !booking.delivery_zone_id,
    delivery_cost:
      booking.delivery_cost === null || booking.delivery_cost === undefined
        ? null
        : MathBN.convert(booking.delivery_cost as BigNumberInput).toNumber(),
  }
}

async function pickupAddress(container: MedusaContainer): Promise<EmailAddress> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "stock_location",
    fields: ["address.address_1", "address.postal_code", "address.city", "address.phone"],
    filters: { name: STOCK_LOCATION_NAME },
  })
  const a = data[0]?.address as Partial<EmailAddress> | undefined
  return {
    address_1: a?.address_1 ?? VENUE_ADDRESS.address_1,
    postal_code: a?.postal_code ?? VENUE_ADDRESS.postal_code,
    city: a?.city ?? VENUE_ADDRESS.city,
    phone: a?.phone ?? VENUE_ADDRESS.phone,
  }
}

function common(
  purchase: Purchase,
  term: EmailOrderData["term"],
  address: EmailAddress,
  admin: string,
  booking: BookingLike
): EmailOrderData {
  const links = emailLinks()
  const notes = purchase.metadata?.order_notes
  return {
    term,
    items: items(purchase.items),
    total: num(purchase.item_total),
    discount: discountOf(purchase),
    pickup_address: address,
    fulfillment: fulfillment(purchase, booking),
    contact: contact(purchase),
    invoice: invoice(purchase),
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    links: { terms: links.terms, shop: links.shop, admin },
  }
}

export async function loadOrderEmailData(
  container: MedusaContainer,
  orderId: string
): Promise<OrderEmailData> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", ...PURCHASE_FIELDS],
    filters: { id: orderId },
  })
  const order = data[0] as unknown as (Purchase & { id: string; display_id: number | string }) | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} not found`)
  }
  const term = parseTerm(order.metadata)
  if (!term) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Order ${orderId} has no pickup term`)
  }
  return {
    ...common(
      order,
      { date: term.date, start: term.start, end: term.end },
      await pickupAddress(container),
      `${emailLinks().admin}/orders/${order.id}`,
      await findOrderBooking(container, order.id)
    ),
    order_id: order.id,
    display_id: Number(order.display_id),
  }
}

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null

/** A request has no order yet: its data comes from the booking and its cart. */
export async function loadRequestEmailData(
  container: MedusaContainer,
  bookingId: string
): Promise<RequestEmailData> {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  const [booking] = await catering.listBookings({ id: bookingId })
  if (!booking) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Request ${bookingId} not found`)
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", ...PURCHASE_FIELDS],
    filters: { id: booking.cart_id },
  })
  const cart = (data[0] ?? {}) as Purchase
  const base = common(
    cart,
    { date: booking.date, start: booking.start_time, end: booking.end_time },
    await pickupAddress(container),
    `${emailLinks().admin}/pickup-requests`,
    booking
  )
  return {
    ...base,
    links: { ...base.links, request_status: `${emailLinks().shop}/zapytanie/${booking.cart_id}` },
    request_id: booking.id,
    cart_id: booking.cart_id,
    response_deadline: iso(booking.response_deadline),
    payment_deadline: iso(booking.payment_deadline),
  }
}
