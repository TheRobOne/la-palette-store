/**
 * Template data stored on each notification (`notification.data`) and
 * rendered by the provider. Plain JSON — retries render the same data again.
 */

export type EmailTerm = { date: string; start: string; end: string }

export type EmailItem = {
  title: string
  variant_title: string | null
  quantity: number
  /** gross line total before discount codes, PLN */
  total: number
}

/** Discount codes of the order or request (apps/backend/AGENTS.md "Discount codes"). */
export type EmailDiscount = {
  codes: string[]
  /** gross PLN off the products */
  items_amount: number
  /** gross PLN off the delivery */
  shipping_amount: number
}

export type EmailAddress = {
  address_1: string
  postal_code: string
  city: string
  phone: string | null
}

/**
 * How the order is fulfilled (spec 007). Absent in data stored before
 * delivery existed → pickup.
 */
export type EmailFulfillment =
  | { method: "pickup" }
  | {
      method: "delivery"
      address: EmailAddress
      zone_name: string | null
      out_of_zone: boolean
      /** gross PLN; null while the kitchen has not set an out-of-zone cost */
      delivery_cost: number | null
    }

export type EmailInvoice = {
  company: string
  nip: string
  address: string
}

export type EmailContact = {
  name: string | null
  email: string | null
  phone: string | null
}

/** Shared by order and request e-mails. */
export type EmailOrderData = {
  term: EmailTerm
  items: EmailItem[]
  /** gross item total after discounts, PLN (without delivery) */
  total: number
  /** absent in data stored before discount codes existed */
  discount?: EmailDiscount | null
  /** the venue: pickup address and the contact phone of every e-mail */
  pickup_address: EmailAddress
  fulfillment?: EmailFulfillment
  contact: EmailContact
  invoice: EmailInvoice | null
  notes: string | null
  links: {
    terms: string
    shop: string
    /** customer status / payment page of a request */
    request_status?: string
    /** staff link to the order or the requests page in the Admin */
    admin: string
  }
}

export type OrderEmailData = EmailOrderData & {
  order_id: string
  display_id: number
}

export type RequestEmailData = EmailOrderData & {
  request_id: string
  cart_id: string
  response_deadline: string | null
  payment_deadline: string | null
}

export type RenderedEmail = { subject: string; html: string; text: string }

/** Staff moved the pickup of an order (display_id) or a request (status link). */
export type RescheduledEmailData = (OrderEmailData | RequestEmailData) & {
  previous_term: EmailTerm
}
