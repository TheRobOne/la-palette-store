/**
 * Polish names of the e-mail templates for the Admin. Dependency-free on
 * purpose: used by the Admin bundle (order widget, "Zapytania" page).
 */
export const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  "order-confirmation": "Potwierdzenie zamówienia",
  "staff-new-order": "Obsługa: nowe zamówienie",
  "request-created": "Zapytanie przyjęte",
  "request-confirmed": "Zapytanie potwierdzone (płatność)",
  "request-declined": "Zapytanie odrzucone",
  "request-expired": "Zapytanie wygasło",
  "request-canceled": "Anulowane — brak płatności",
  "staff-new-request": "Obsługa: nowe zapytanie",
  "staff-request-reminder": "Obsługa: przypomnienie o zapytaniu",
  "pickup-rescheduled": "Zmiana terminu odbioru",
  "order-canceled": "Zamówienie anulowane",
  "pickup-reminder": "Przypomnienie o odbiorze",
}

export type AdminEmailDto = {
  id: string
  resource_id: string
  template: string
  to: string
  status: "pending" | "success" | "failure"
  created_at: string
  attempts: number
}

export const EMAIL_STATUS_LABELS: Record<AdminEmailDto["status"], string> = {
  pending: "w trakcie",
  success: "wysłany",
  failure: "błąd wysyłki",
}

export const emailTemplateLabel = (template: string) => EMAIL_TEMPLATE_LABELS[template] ?? template
