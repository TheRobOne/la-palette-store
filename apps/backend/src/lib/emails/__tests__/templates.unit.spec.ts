import { renderTemplate, TEMPLATES } from "../templates"
import type { OrderEmailData, RequestEmailData } from "../types"

const base = {
  term: { date: "2026-10-30", start: "10:00", end: "11:00" },
  items: [
    { title: "Mini tarta", variant_title: null, quantity: 12, total: 144 },
    { title: "Box <Włoski>", variant_title: "duży", quantity: 1, total: 220 },
  ],
  total: 364,
  pickup_address: {
    address_1: "ul. Gustawa Morcinka 40",
    postal_code: "31-762",
    city: "Kraków",
    phone: "+48 734 431 447",
  },
  contact: { name: "Anna Nowak", email: "anna@example.com", phone: "+48 600 100 200" },
  invoice: null,
  notes: 'Bez orzechów <script>alert("x")</script>',
  links: {
    terms: "https://lapalettegarden.pl/catering/regulamin",
    shop: "https://lapalettegarden.pl/catering",
    admin: "https://api.example.com/app/orders/order_1",
  },
}

const order: OrderEmailData = { ...base, order_id: "order_1", display_id: 42 }

const request: RequestEmailData = {
  ...base,
  links: {
    ...base.links,
    admin: "https://api.example.com/app/pickup-requests",
    request_status: "https://lapalettegarden.pl/catering/zapytanie/cart_1",
  },
  request_id: "bkg_1",
  cart_id: "cart_1",
  response_deadline: "2026-10-27T13:00:00.000Z",
  payment_deadline: "2026-10-28T13:00:00.000Z",
}

describe("e-mail templates (unit)", () => {
  it("order confirmation contains everything the contract confirmation needs", () => {
    const { subject, html, text } = renderTemplate("order-confirmation", order)
    expect(subject).toBe("Potwierdzenie zamówienia nr 42")
    for (const part of [
      "pt 30.10.2026, 10:00–11:00",
      "ul. Gustawa Morcinka 40, 31-762 Kraków",
      "Mini tarta × 12: 144,00 zł",
      "Box <Włoski> (duży) × 1: 220,00 zł",
      "Razem: 364,00 zł",
      "Regulamin sklepu: https://lapalettegarden.pl/catering/regulamin",
      "potwierdzenie zawarcia umowy",
    ]) {
      expect(text).toContain(part)
    }
    expect(html).toContain("https://lapalettegarden.pl/catering/regulamin")
    expect(html).toContain("364,00 zł")
  })

  it("escapes customer-entered text in HTML but keeps it readable in text", () => {
    const { html, text } = renderTemplate("order-confirmation", order)
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("Box &lt;Włoski&gt;")
    expect(text).toContain('Bez orzechów <script>alert("x")</script>')
  })

  it("shows invoice data only when requested", () => {
    expect(renderTemplate("order-confirmation", order).text).not.toContain("NIP")
    const withInvoice = renderTemplate("order-confirmation", {
      ...order,
      invoice: { company: "Firma Sp. z o.o.", nip: "1234563218", address: "ul. Testowa 1, 30-001 Kraków" },
    }).text
    expect(withInvoice).toContain("Firma: Firma Sp. z o.o.")
    expect(withInvoice).toContain("NIP: 1234563218")
  })

  it("request e-mails carry the right deadline and link", () => {
    const created = renderTemplate("request-created", request)
    expect(created.subject).toBe("Otrzymaliśmy zapytanie o termin pt 30.10.2026")
    expect(created.text).toContain("To jeszcze nie jest zamówienie")
    expect(created.text).toContain("do wt. 27.10, 14:00")
    expect(created.text).toContain("https://lapalettegarden.pl/catering/zapytanie/cart_1")

    const confirmed = renderTemplate("request-confirmed", request)
    expect(confirmed.subject).toBe("Kuchnia potwierdziła termin pt 30.10.2026 — zapłać do śr. 28.10, 14:00")
    expect(confirmed.text).toContain("Zapłać za zamówienie: https://lapalettegarden.pl/catering/zapytanie/cart_1")

    for (const template of ["request-declined", "request-expired", "request-canceled"] as const) {
      const { text } = renderTemplate(template, request)
      expect(text).not.toContain("Zapłać za zamówienie")
      expect(text).toContain("https://lapalettegarden.pl/catering")
    }
  })

  it("staff e-mails carry the customer contact and the Admin link", () => {
    const newOrder = renderTemplate("staff-new-order", order)
    expect(newOrder.subject).toBe("Nowe zamówienie nr 42 — odbiór pt 30.10.2026 10:00–11:00")
    expect(newOrder.text).toContain("anna@example.com")
    expect(newOrder.text).toContain("+48 600 100 200")
    expect(newOrder.text).toContain("Faktura: nie")
    expect(newOrder.text).toContain("https://api.example.com/app/orders/order_1")

    const newRequest = renderTemplate("staff-new-request", request)
    expect(newRequest.subject).toBe("Nowe zapytanie na pt 30.10.2026 — odpowiedz do wt. 27.10, 14:00")
    expect(newRequest.text).toContain("https://api.example.com/app/pickup-requests")

    const reminder = renderTemplate("staff-request-reminder", request)
    expect(reminder.subject).toBe("Przypomnienie: zapytanie na pt 30.10.2026 wygaśnie wt. 27.10, 14:00")
  })

  it("tells the customer about a moved pickup (order or request)", () => {
    const previous_term = { date: "2026-10-29", start: "12:00", end: "13:00" }
    const forOrder = renderTemplate("pickup-rescheduled", { ...order, previous_term })
    expect(forOrder.subject).toBe("Zmiana terminu odbioru: pt 30.10.2026")
    expect(forOrder.text).toContain("zamówienia nr 42")
    expect(forOrder.text).toContain("Poprzedni termin: czw. 29.10.2026, 12:00–13:00")
    expect(forOrder.text).toContain("Nowy termin: pt 30.10.2026, 10:00–11:00")

    const forRequest = renderTemplate("pickup-rescheduled", { ...request, previous_term })
    expect(forRequest.text).toContain("w Twoim zapytaniu")
    expect(forRequest.text).toContain("https://lapalettegarden.pl/catering/zapytanie/cart_1")
  })

  it("covers cancellation and the pickup reminder", () => {
    const canceled = renderTemplate("order-canceled", order)
    expect(canceled.subject).toBe("Zamówienie nr 42 zostało anulowane")
    expect(canceled.text).toContain("zwrócimy pieniądze")

    const reminder = renderTemplate("pickup-reminder", order)
    expect(reminder.subject).toBe("Jutro odbiór zamówienia nr 42")
    expect(reminder.text).toContain("pt 30.10.2026, 10:00–11:00")
    expect(reminder.text).toContain("https://www.google.com/maps/search/?api=1&query=")
    expect(reminder.text).toContain("Mini tarta × 12")
  })

  it("every template renders html with the logo and a plain-text part", () => {
    const previous_term = { date: "2026-10-29", start: "12:00", end: "13:00" }
    for (const name of Object.keys(TEMPLATES)) {
      const data =
        name === "pickup-rescheduled"
          ? { ...order, previous_term }
          : name.includes("request")
            ? request
            : order
      const { subject, html, text } = renderTemplate(name, data)
      expect(subject.length).toBeGreaterThan(5)
      expect(html).toContain('lang="pl"')
      expect(html).toContain("logo-full-kolor.png")
      expect(text.length).toBeGreaterThan(50)
    }
  })

  it("rejects an unknown template", () => {
    expect(() => renderTemplate("nope", order)).toThrow(/Unknown e-mail template/)
  })
})

// spec 007 — delivery orders and requests (contracts/emails.md)
describe("delivery e-mails (unit)", () => {
  const delivery = {
    method: "delivery" as const,
    address: { address_1: "ul. Przykładowa 5/2", postal_code: "31-870", city: "Kraków", phone: "+48 600 000 000" },
    zone_name: "Strefa 1",
    out_of_zone: false,
    delivery_cost: 30,
  }
  const deliveryOrder: OrderEmailData = { ...order, fulfillment: delivery }
  const deliveryRequest: RequestEmailData = { ...request, fulfillment: delivery }
  const outOfZone: RequestEmailData = {
    ...request,
    fulfillment: { ...delivery, zone_name: null, out_of_zone: true, delivery_cost: null },
  }
  const ADDRESS = "ul. Przykładowa 5/2, 31-870 Kraków"
  const VENUE = "Gustawa Morcinka"

  const expectDelivery = (email: { html: string; text: string }) => {
    expect(email.text).toContain(`Adres dostawy: ${ADDRESS}`)
    expect(email.text).not.toContain(VENUE)
    expect(email.text).not.toContain("Adres odbioru")
    expect(email.html).not.toContain("google.com/maps")
  }

  it("order confirmation: window, address, phone, cost line before the total", () => {
    const email = renderTemplate("order-confirmation", deliveryOrder)
    expect(email.subject).toEqual("Potwierdzenie zamówienia nr 42")
    expectDelivery(email)
    expect(email.text).toContain("Dostawa: pt 30.10.2026, 10:00–11:00")
    expect(email.text).toContain("Telefon: +48 600 000 000")
    expect(email.text).toContain("Dostawa: 30,00 zł\nRazem: 394,00 zł")
    expect(email.text).toContain("Dowieziemy je pod wskazany adres")
  })

  it("free delivery reads as gratis", () => {
    const email = renderTemplate("order-confirmation", {
      ...deliveryOrder,
      fulfillment: { ...delivery, delivery_cost: 0 },
    })
    expect(email.text).toContain("Dostawa: gratis\nRazem: 364,00 zł")
  })

  it("request e-mails name the delivery; out of zone the cost comes with the confirmation", () => {
    const created = renderTemplate("request-created", outOfZone)
    expect(created.subject).toEqual("Otrzymaliśmy zapytanie o dostawę pt 30.10.2026")
    expectDelivery(created)
    expect(created.text).toContain("Koszt dostawy podamy razem z potwierdzeniem.")
    expect(created.text).toContain("Razem (bez dostawy): 364,00 zł")

    const confirmed = renderTemplate("request-confirmed", { ...outOfZone, fulfillment: { ...outOfZone.fulfillment!, delivery_cost: 80 } as never })
    expect(confirmed.subject).toMatch(/^Kuchnia potwierdziła dostawę pt 30\.10\.2026 — zapłać do /)
    expect(confirmed.text).toContain("Dostawa: 80,00 zł\nRazem: 444,00 zł")

    for (const name of ["request-declined", "request-expired", "request-canceled"] as const) {
      expectDelivery(renderTemplate(name, deliveryRequest))
    }
    expect(renderTemplate("request-expired", deliveryRequest).subject).toEqual(
      "Zapytanie o dostawę pt 30.10.2026 wygasło"
    )
  })

  it("reschedule, cancellation and the reminder speak about delivery", () => {
    const moved = renderTemplate("pickup-rescheduled", {
      ...deliveryOrder,
      previous_term: { date: "2026-10-29", start: "12:00", end: "14:00" },
    })
    expect(moved.subject).toEqual("Zmiana terminu dostawy: pt 30.10.2026")
    expect(moved.text).toContain("Zmieniliśmy termin dostawy zamówienia nr 42.")
    expectDelivery(moved)

    expect(renderTemplate("order-canceled", deliveryOrder).text).toContain(
      "Zamówienie nr 42 z dostawą na pt 30.10.2026, 10:00–11:00 zostało anulowane."
    )

    const reminder = renderTemplate("pickup-reminder", deliveryOrder)
    expect(reminder.subject).toEqual("Jutro dostawa zamówienia nr 42")
    expectDelivery(reminder)
    expect(reminder.text).toContain("Kierowca zadzwoni pod numer +48 600 000 000.")
    expect(reminder.text).not.toContain("Jak dojechać")
  })

  it("staff e-mails carry the address, the zone or out of zone, and the cost", () => {
    const staff = renderTemplate("staff-new-order", deliveryOrder)
    expect(staff.subject).toEqual("Nowe zamówienie nr 42 — dostawa pt 30.10.2026 10:00–11:00")
    expect(staff.text).toContain("Strefa: Strefa 1")
    expect(staff.text).toContain("Dostawa: 30,00 zł")
    expect(staff.text).toContain(ADDRESS)

    for (const name of ["staff-new-request", "staff-request-reminder"] as const) {
      expect(renderTemplate(name, outOfZone).text).toContain(
        "Strefa: poza strefą — podaj koszt dostawy przy potwierdzeniu"
      )
    }
  })

  it("keeps pickup e-mails unchanged when fulfillment is absent or pickup", () => {
    for (const name of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]) {
      const data = name.startsWith("request") || name.startsWith("staff-request") || name === "staff-new-request"
        ? request
        : { ...order, previous_term: base.term }
      expect(renderTemplate(name, { ...data, fulfillment: { method: "pickup" } })).toEqual(
        renderTemplate(name, data)
      )
    }
  })
})


describe("discount codes in e-mails (unit, discount codes)", () => {
  // items before the discount: 144 + 220 = 364; 30 zł off → 334
  const discounted: OrderEmailData = {
    ...order,
    total: 334,
    discount: { codes: ["WESELE30"], items_amount: 30, shipping_amount: 0 },
  }

  it("shows the discount line between the items and the total", () => {
    const { html, text } = renderTemplate("order-confirmation", discounted)
    expect(text).toContain("Box <Włoski> (duży) × 1: 220,00 zł\nRabat (WESELE30): −30,00 zł\nRazem: 334,00 zł")
    expect(html).toContain("Rabat (WESELE30)")
  })

  it("puts the discount before the delivery and subtracts a delivery discount once", () => {
    const delivery = {
      method: "delivery" as const,
      address: { address_1: "ul. Przykładowa 5/2", postal_code: "31-870", city: "Kraków", phone: null },
      zone_name: "Strefa 2",
      out_of_zone: false,
      delivery_cost: 50,
    }
    const email = renderTemplate("order-confirmation", {
      ...discounted,
      fulfillment: delivery,
      discount: { codes: ["DOSTAWA", "WESELE30"], items_amount: 30, shipping_amount: 20 },
    })
    expect(email.text).toContain(
      "Rabat (DOSTAWA, WESELE30): −50,00 zł\nDostawa: 50,00 zł\nRazem: 364,00 zł"
    )
  })

  it("leaves e-mails without a discount unchanged", () => {
    const { text } = renderTemplate("order-confirmation", { ...order, discount: null })
    expect(text).not.toContain("Rabat")
    expect(text).toContain("Razem: 364,00 zł")
  })
})
