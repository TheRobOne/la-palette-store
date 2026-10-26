import { formatDate, formatDeadline } from "../format"
import {
  button,
  contactBlock,
  field,
  heading,
  link,
  orderSummary,
  paragraph,
  render,
} from "../layout"
import type { RenderedEmail, RequestEmailData } from "../types"

/**
 * Customer e-mails for requests on on-request terms (spec 006 US2, one per
 * state change of specs/005-on-request-terms) and the staff alerts (US3).
 */

const statusLink = (data: RequestEmailData) => data.links.request_status ?? data.links.shop

export function requestCreated(data: RequestEmailData): RenderedEmail {
  return render(`Otrzymaliśmy zapytanie o termin ${formatDate(data.term.date)}`, [
    paragraph(
      "Dziękujemy za zapytanie. To jeszcze nie jest zamówienie: kuchnia musi potwierdzić " +
        "termin, a płacisz dopiero po potwierdzeniu."
    ),
    ...orderSummary(data),
    ...(data.response_deadline
      ? [paragraph(`Odpowiemy najpóźniej do ${formatDeadline(data.response_deadline)}.`)]
      : []),
    link("Sprawdź status zapytania", statusLink(data)),
    contactBlock(data.pickup_address),
  ])
}

export function requestConfirmed(data: RequestEmailData): RenderedEmail {
  const deadline = data.payment_deadline ? formatDeadline(data.payment_deadline) : null
  return render(
    `Kuchnia potwierdziła termin ${formatDate(data.term.date)}${deadline ? ` — zapłać do ${deadline}` : ""}`,
    [
      paragraph("Dobra wiadomość: kuchnia potwierdziła Twój termin."),
      ...orderSummary(data),
      ...(deadline
        ? [
            paragraph(
              `Zapłać do ${deadline}. Bez płatności w tym czasie zamówienie zostanie anulowane, ` +
                "a termin zwolniony."
            ),
          ]
        : []),
      button("Zapłać za zamówienie", statusLink(data)),
      contactBlock(data.pickup_address),
    ]
  )
}

export function requestDeclined(data: RequestEmailData): RenderedEmail {
  return render(`Nie możemy przyjąć zamówienia na ${formatDate(data.term.date)}`, [
    paragraph(
      `Przepraszamy — kuchnia nie może przyjąć zamówienia na ${formatDate(data.term.date)}. ` +
        "Nie pobraliśmy żadnej płatności."
    ),
    paragraph("Możesz wybrać inny termin w sklepie."),
    link("Przejdź do sklepu", data.links.shop),
    contactBlock(data.pickup_address),
  ])
}

export function requestExpired(data: RequestEmailData): RenderedEmail {
  return render(`Zapytanie o termin ${formatDate(data.term.date)} wygasło`, [
    paragraph(
      "Kuchnia nie odpowiedziała na Twoje zapytanie na czas, więc wygasło. Przepraszamy. " +
        "Nie pobraliśmy żadnej płatności."
    ),
    paragraph("Możesz wysłać nowe zapytanie albo wybrać inny termin w sklepie."),
    link("Przejdź do sklepu", data.links.shop),
    contactBlock(data.pickup_address),
  ])
}

export function requestCanceled(data: RequestEmailData): RenderedEmail {
  return render(`Zamówienie na ${formatDate(data.term.date)} anulowane — brak płatności`, [
    paragraph(
      "Zamówienie nie zostało opłacone w wyznaczonym czasie, więc je anulowaliśmy, a termin " +
        "zwolniliśmy."
    ),
    paragraph("Jeśli nadal chcesz zamówić, wybierz termin w sklepie."),
    link("Przejdź do sklepu", data.links.shop),
    contactBlock(data.pickup_address),
  ])
}

const staffRequestBlocks = (data: RequestEmailData) => [
  ...orderSummary(data),
  heading("Klient"),
  field("Imię i nazwisko:", data.contact.name ?? "—"),
  field("E-mail:", data.contact.email ?? "—"),
  field("Telefon:", data.contact.phone ?? "—"),
  ...(data.response_deadline
    ? [field("Odpowiedz do:", formatDeadline(data.response_deadline))]
    : []),
  button("Potwierdź albo odrzuć w panelu", data.links.admin),
]

export function staffNewRequest(data: RequestEmailData): RenderedEmail {
  const deadline = data.response_deadline ? ` — odpowiedz do ${formatDeadline(data.response_deadline)}` : ""
  return render(`Nowe zapytanie na ${formatDate(data.term.date)}${deadline}`, [
    paragraph("Nowe zapytanie o termin na zapytanie. Bez decyzji w wyznaczonym czasie wygaśnie."),
    ...staffRequestBlocks(data),
  ])
}

export function staffRequestReminder(data: RequestEmailData): RenderedEmail {
  const deadline = data.response_deadline ? ` wygaśnie ${formatDeadline(data.response_deadline)}` : ""
  return render(`Przypomnienie: zapytanie na ${formatDate(data.term.date)}${deadline}`, [
    paragraph("To zapytanie wciąż czeka na decyzję i niedługo wygaśnie."),
    ...staffRequestBlocks(data),
  ])
}
