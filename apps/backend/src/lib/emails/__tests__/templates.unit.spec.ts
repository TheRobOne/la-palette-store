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

  it("every template renders html with the logo and a plain-text part", () => {
    for (const name of Object.keys(TEMPLATES)) {
      const data = name.startsWith("request") || name.includes("request") ? request : order
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
