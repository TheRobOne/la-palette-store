# E-mail changes for delivery

Extends [006 contracts/emails.md](../../006-transactional-emails/contracts/emails.md). Template
ids, idempotency keys and sending rules are unchanged (research R-10); for a delivery order or
request the subject and content follow the method. Pickup e-mails stay exactly as they are.

| Template | Delivery subject | Delivery content instead of pickup info |
|---|---|---|
| `order-confirmation` | unchanged | "Dostawa" with date + window, delivery address and phone, delivery cost as its own line before the total |
| `request-created` | `Otrzymaliśmy zapytanie o dostawę {date}` | delivery address; out of zone: "koszt dostawy podamy razem z potwierdzeniem" |
| `request-confirmed` | `Kuchnia potwierdziła dostawę {date} — zapłać do {payment_deadline}` | delivery address, delivery cost line, total including it |
| `request-declined` / `request-expired` / `request-canceled` | "dostawa" instead of "termin odbioru" where the term is named | delivery address |
| `pickup-rescheduled` | `Zmiana terminu dostawy: {new date}` | previous and new window, delivery address |
| `order-canceled` | unchanged | term labelled "Dostawa" |
| `pickup-reminder` | `Jutro dostawa zamówienia nr {display_id}` | window, delivery address, "kierowca zadzwoni pod numer {phone}", items, contact; no venue map link |
| `staff-new-order` | `Nowe zamówienie nr {display_id} — dostawa {date} {window}` | address, phone, zone name (or "poza strefą"), delivery cost |
| `staff-new-request` / `staff-request-reminder` | unchanged | address, zone name or "poza strefą — podaj koszt dostawy przy potwierdzeniu" |

Final wording is reviewed with the manager (entry in `docs/do-omowienia-z-managerem.md`).
