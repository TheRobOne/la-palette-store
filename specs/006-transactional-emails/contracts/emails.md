# E-mail catalogue

All e-mails: Polish, sender `EMAIL_FROM`, reply-to `EMAIL_REPLY_TO`, HTML + plain text, one
column, readable from 360 px. Dates as `pt 24.10.2026`, windows `10:00–11:00`, deadlines as
`pt 24.10, 14:30` (Warsaw time), amounts `144,00 zł`. Texts below are the subjects and the
required content; final wording is reviewed with the manager (task T040).

## Customer

| Template | Subject | Must contain |
|---|---|---|
| `order-confirmation` | `Potwierdzenie zamówienia nr {display_id}` | order no., pickup date + window, pickup address, items (name, variant, qty, price), total, invoice data if requested, order notes, link to `/catering/regulamin`, contact for questions; "Zachowaj tę wiadomość — to potwierdzenie zawarcia umowy." |
| `request-created` | `Otrzymaliśmy zapytanie o termin {date}` | term, items, total, "to nie jest jeszcze zamówienie — płacisz dopiero po potwierdzeniu", response deadline, status link |
| `request-confirmed` | `Kuchnia potwierdziła termin {date} — zapłać do {payment_deadline}` | term, items, total, payment deadline, button "Zapłać za zamówienie" → status link (payment there, 005 §4), what happens without payment |
| `request-declined` | `Nie możemy przyjąć zamówienia na {date}` | term, apology, link to the shop to choose another term, contact |
| `request-expired` | `Zapytanie o termin {date} wygasło` | term, "kuchnia nie odpowiedziała na czas", link to the shop, contact |
| `request-canceled` | `Zamówienie na {date} anulowane — brak płatności` | term, "nie opłacono w wyznaczonym czasie", link to the shop |
| `pickup-rescheduled` | `Zmiana terminu odbioru: {new date}` | previous and new date + window, pickup address, order no. or status link |
| `order-canceled` | `Zamówienie nr {display_id} zostało anulowane` | order no., term, information about the refund for paid orders (text agreed with the manager), contact |
| `pickup-reminder` | `Jutro odbiór zamówienia nr {display_id}` | date + window, pickup address with map link, items, contact |

## Staff (`catering_staff_email`)

| Template | Subject | Must contain |
|---|---|---|
| `staff-new-order` | `Nowe zamówienie nr {display_id} — odbiór {date} {window}` | term, items, total, customer name, e-mail, phone, invoice yes/no, notes, Admin link `/app/orders/{id}` |
| `staff-new-request` | `Nowe zapytanie na {date} — odpowiedz do {response_deadline}` | term, items, total, customer contact, deadline, Admin link `/app/pickup-requests` |
| `staff-request-reminder` | `Przypomnienie: zapytanie na {date} wygaśnie {response_deadline}` | same as above |

## Sending rules

- Once per template, record and recipient (idempotency keys: research R-05).
- Outside production only to `NOTIFICATION_ALLOWLIST`; otherwise logged (research R-03).
- A paid request produces `order-confirmation` + `staff-new-order`, never another request
  e-mail.
- No staff address set → staff templates are skipped with a log line; customer e-mails still go.
