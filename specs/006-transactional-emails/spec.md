# Feature Specification: Transactional E-mails

**Feature Branch**: `006-transactional-emails`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Zaplanuj prace nad mailami. Sklep wysyła klientowi maile
transakcyjne: potwierdzenie zamówienia oraz każdą zmianę stanu zapytania o termin (wysłane,
potwierdzone z linkiem do płatności, odrzucone, wygasło, anulowane za brak płatności), a także
zmianę terminu odbioru i anulowanie zamówienia przez obsługę. Dzień przed odbiorem klient
dostaje przypomnienie. Obsługa dostaje mail o każdym nowym zamówieniu i zapytaniu oraz
przypomnienie, gdy kończy się czas na odpowiedź. Wysyłka przez Resend z domeny
lapalettegarden.pl. Zdarzenia catering.request.* ze spec 005 czekają na tę funkcję."

## Clarifications

### Session 2026-10-26

- Q: Which sending service? → A: Resend, from the lapalettegarden.pl domain (requires DNS
  records for sender authentication).
- Q: Do staff get e-mails too? → A: yes — every new order and new request, plus a reminder
  when a request's response time is running out.
- Q: Pickup reminder for the customer? → A: yes, the day before the pickup.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer receives an order confirmation (Priority: P1)

A customer pays for an order and, within a minute, receives an e-mail confirming it: order
number, pickup date and window, pickup address, the products with quantities and prices, the
total, invoice data if requested, and a link to the shop's terms. The e-mail is their record
of the purchase; the confirmation page in the shop shows full details only in the browser
that placed the order.

**Why this priority**: Polish consumer law requires confirming a distance contract on a
durable medium; without it the shop cannot launch. It is also the customer's only record of
the order outside the browser that placed it.

**Independent Test**: complete a standard order with the test payment and check that one
confirmation e-mail with the correct contents arrives at the customer's address.

**Acceptance Scenarios**:

1. **Given** a cart with a standard pickup term, **When** the customer completes it, **Then**
   one confirmation e-mail is sent to the cart's e-mail address with the order number, term,
   pickup address, items, total and a link to the terms of service.
2. **Given** the customer asked for an invoice, **When** the order is confirmed, **Then** the
   e-mail shows the company name, NIP and address as given.
3. **Given** a confirmed on-request order (paid after confirmation), **When** it is paid,
   **Then** the customer receives the same order confirmation.
4. **Given** the sending service is temporarily unavailable, **When** the order is placed,
   **Then** the order still succeeds and the e-mail is sent once the service is available
   again.

---

### User Story 2 - Customer is told about every change to their request (Priority: P1)

A customer who sent a request for an on-request term receives an e-mail at each step: request
received (with the response deadline and the status link), confirmed (with the payment
deadline and a payment link), declined, expired without an answer, or cancelled because it
was not paid in time.

**Why this priority**: today the status page is the customer's only channel (spec 005
FR-010). A confirmed request has a payment deadline — if the customer does not learn about the
confirmation, the request is cancelled and the kitchen loses the order.

**Independent Test**: send a request, confirm it in the Admin, let another one expire, and
check that each step produces exactly one e-mail with the right text and link.

**Acceptance Scenarios**:

1. **Given** a request was just sent, **Then** the customer receives "zapytanie przyjęte" with
   the term, products, response deadline and the status page link.
2. **Given** staff confirm the request, **Then** the customer receives "kuchnia potwierdziła"
   with the payment deadline and a link that leads straight to payment.
3. **Given** staff decline it, or it expires without an answer, or it is cancelled for lack of
   payment, **Then** the customer receives one e-mail saying so, without a payment link.
4. **Given** the request is paid, **Then** the customer receives the order confirmation (US1)
   and no further request e-mail.

---

### User Story 3 - Staff are notified of new orders and requests (Priority: P1)

The kitchen's shared address receives an e-mail for every new paid order and every new
request, with the term, products, customer contact and a link to it in the Admin. When a
request's response time is running out and nobody has decided yet, staff receive a reminder.

**Why this priority**: a request expires after 24 h without an answer; staff who do not open
the Admin in time lose the order. New orders must reach the kitchen without anyone watching
the panel.

**Independent Test**: place an order and send a request; check that the staff address
receives one e-mail for each; leave a request undecided and check the reminder arrives
before its deadline.

**Acceptance Scenarios**:

1. **Given** a new paid order, **Then** the staff address receives "nowe zamówienie" with the
   order number, term, items, total, customer e-mail and phone, and an Admin link.
2. **Given** a new request, **Then** the staff address receives "nowe zapytanie — odpowiedz do
   …" with the same data and a link to the Admin "Zapytania" page.
3. **Given** a request is still undecided a few hours before its response deadline, **Then**
   staff receive one reminder; a request decided before that gets none.
4. **Given** staff change the staff address in the Admin, **Then** later notifications go to
   the new address.

---

### User Story 4 - Customer is told when staff change or cancel their order (Priority: P2)

When staff move an order's or a request's pickup term, or cancel an order, the customer
receives an e-mail with the new term or the cancellation.

**Why this priority**: a moved pickup the customer does not know about means a wasted trip or
an uncollected order; it happens rarely, so it follows the P1 flows.

**Independent Test**: reschedule an order in the Admin and cancel another; check one e-mail
each with the old and new term or the cancellation.

**Acceptance Scenarios**:

1. **Given** staff reschedule an order's or a request's term, **Then** the customer receives
   "zmiana terminu odbioru" with the old and the new term.
2. **Given** staff cancel an order, **Then** the customer receives "zamówienie anulowane".

---

### User Story 5 - Customer receives a pickup reminder (Priority: P3)

The day before the pickup the customer receives a reminder with the date, window, pickup
address and the list of products.

**Why this priority**: fewer forgotten pickups; useful but not needed to launch.

**Independent Test**: place an order for tomorrow-but-one, run the reminder at its scheduled
time, check one reminder arrives and a second run sends nothing.

**Acceptance Scenarios**:

1. **Given** a paid order with a pickup tomorrow, **When** the reminder runs, **Then** the
   customer receives one reminder.
2. **Given** the order was cancelled or rescheduled to a later day, **Then** no reminder is
   sent for the old date.

---

### Edge Cases

- The same event is delivered twice (retry) or the expiry job runs twice → the customer and
  staff get each e-mail only once.
- The sending service fails or times out → the order/request flow is unaffected; the e-mail is
  retried and, if it still fails, staff can see that it was not delivered.
- The customer's address bounces or is invalid → the order stays valid; the failure is
  recorded for staff.
- An order is placed less than 24 h before its pickup → no separate pickup reminder (the
  confirmation is enough).
- A request is confirmed close to its window start (payment deadline capped at the start, spec
  005) → the confirmation e-mail shows the real, shorter deadline.
- Staging and local environments → e-mails reach only addresses on an allow-list (the team),
  never real customers; with no allow-list nothing is sent and the e-mail is only logged.
- The staff address is not set → customer e-mails still go out; staff e-mails are skipped and
  logged.
- An order placed through the Admin (draft order) → follows the same rules as a shop order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST send the customer an order confirmation for every placed order,
  with: order number, pickup date and window, pickup address, items (name, quantity, price),
  total, invoice data when requested, order notes, and a link to the terms of service — the
  confirmation of the contract on a durable medium required by Polish consumer law.
- **FR-002**: The system MUST send the customer one e-mail for each request state change:
  created (response deadline, status link), confirmed (payment deadline, payment link),
  declined, expired, cancelled for lack of payment.
- **FR-003**: The system MUST send the staff address one e-mail for each new placed order and
  each new request, containing the term, items, total, customer contact and an Admin link.
- **FR-004**: The system MUST remind staff once about a request that is still undecided when a
  configurable time before its response deadline is reached (default 4 h).
- **FR-005**: The system MUST send the customer one e-mail when staff reschedule the pickup
  term of their order or request (old and new term) and when staff cancel their order.
- **FR-006**: The system MUST send the customer one pickup reminder the day before the pickup
  of a placed order that is not cancelled, unless the order was placed less than 24 h before
  the pickup.
- **FR-007**: Each e-mail MUST be sent at most once per event and recipient, even when events
  or jobs run more than once.
- **FR-008**: Sending failures MUST NOT block or roll back order, request or payment
  processing; failed e-mails MUST be retried and the final outcome recorded.
- **FR-009**: Staff MUST be able to see in the Admin, for an order or request, which e-mails
  were sent, when, and whether delivery failed.
- **FR-010**: Staff MUST be able to set the staff notification address in the Admin without a
  deploy.
- **FR-011**: E-mails MUST be in Polish, come from a lapalettegarden.pl address with the La
  Palette Garden name, include a plain-text version, and be readable on a phone (constitution
  VIII).
- **FR-012**: Customer e-mails MUST contain only the data of that order or request; links MUST
  use the existing status page and order pages of the shop (no new public data).
- **FR-013**: Non-production environments MUST send e-mails only to an allow-list of addresses
  and otherwise log them without sending.
- **FR-014**: The payment link in the "confirmed" e-mail MUST lead to the payment step of the
  same confirmed request (spec 005 §4) and must not allow paying a request that is no longer
  payable.

### Key Entities

- **Notification**: one e-mail to one recipient — kind (e.g. order confirmation, request
  confirmed, staff new request, pickup reminder), recipient, related order or request, sent
  time, delivery outcome. Unique per kind, related record and recipient (FR-007).
- **Notification settings**: staff notification address, staff reminder lead time (hours
  before the response deadline), environment allow-list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of placed orders produce exactly one order confirmation to the customer;
  95% arrive within 2 minutes of placing the order.
- **SC-002**: Every request state change (5 kinds) produces exactly one customer e-mail; a
  confirmed request's e-mail arrives within 2 minutes of the staff decision.
- **SC-003**: Staff learn about 100% of new requests by e-mail within 2 minutes; no request
  expires without a staff reminder having been sent first.
- **SC-004**: No duplicate e-mails in the test scenarios that repeat events and jobs.
- **SC-005**: A failure of the sending service causes no failed orders or requests.
- **SC-006**: E-mails from the shop are delivered to the inbox (not spam) of Gmail, Outlook and
  WP/Onet test accounts.

## Assumptions

- Sending uses Resend from a lapalettegarden.pl address (e.g. `zamowienia@lapalettegarden.pl`);
  the domain owner adds the DNS records for sender authentication before launch. Replies go to
  the kitchen's contact address.
- Customer e-mails rely on the e-mail address the customer gives at checkout; there are no
  accounts (guest checkout, constitution II).
- Templates are fixed in code for this feature (Polish texts reviewed with the manager); staff
  editing of texts in the Admin is out of scope.
- The pickup reminder is sent in the morning (Warsaw time) the day before the pickup.
- The staff reminder default is 4 h before the response deadline; the response time itself
  stays as configured in spec 005.
- Payment is still the test payment; when Przelewy24 arrives, the confirmation e-mail is sent
  after successful payment, as now.
- Marketing e-mails, newsletters and texts editable by staff are out of scope; e-mails are
  transactional and need no opt-in.
- The contact-form e-mail of the website (la-palette-garden, Gmail) is not part of this feature.
