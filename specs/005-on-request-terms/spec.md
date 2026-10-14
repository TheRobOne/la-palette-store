# Feature Specification: On-Request Pickup Terms

**Feature Branch**: `005-on-request-terms`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Terminy odbioru na zapytanie. Obsługa może w panelu admina
oznaczyć wybrane okna odbioru (np. całe poniedziałki i wtorki, kiedy kuchnia standardowo nie
pracuje) jako "na zapytanie". Klient widzi takie terminy w sklepie z wyraźnym oznaczeniem, że
wymagają potwierdzenia kuchni i że płaci dopiero po potwierdzeniu. Wybierając taki termin,
klient przechodzi checkout bez płatności i wysyła zapytanie; zapytanie od razu zajmuje miejsce
w dziennym limicie kuchni. Obsługa widzi zapytania w kalendarzu odbiorów i na zamówieniu, i
może je potwierdzić albo odrzucić (bez proponowania innego terminu — impreza zwykle nie
zostanie przeniesiona). Po potwierdzeniu klient dostaje możliwość zapłaty za to konkretne
zamówienie; dopiero opłacone zamówienie jest ostateczne. Zapytanie, na które obsługa nie
odpowie w ustalonym czasie (domyślnie 24 h), wygasa; potwierdzone zamówienie nieopłacone w
ustalonym czasie (domyślnie 24 h) jest automatycznie anulowane — w obu przypadkach miejsce w
limicie się zwalnia, a klient jest o tym poinformowany. W panelu admina obsługa ustawia: które
okna są na zapytanie, osobny minimalny czas wyprzedzenia dla zapytań, czas na odpowiedź i
czas na płatność. Standardowe terminy działają bez zmian. Model musi później pozwolić na to
samo dla dowozu."

## Clarifications

### Session 2026-10-14

Decided with the manager before this spec (constitution 2.3.0, Principle II "On-request
terms"):

- Q: Pay before or after the kitchen confirms? → A: after (request → confirm → pay).
- Q: May staff propose another term instead of declining? → A: no — confirm or decline only.
- Q: Staff response time / payment time? → A: 24 h each, editable in the Admin.
- Q: Which days, and the lead time for requests? → A: chosen by staff in the Admin, with a
  separate lead time for on-request terms.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer sends a request for an on-request term (Priority: P1)

A customer planning an event on a Monday sees that Monday terms are available "on request".
The shop tells them clearly that the kitchen has to confirm first and that they pay only after
the confirmation. They go through checkout without paying and send the request; they see that
the request was received and what happens next.

**Why this priority**: without it customers cannot order for the kitchen's non-standard days
at all; it is the entry point of the whole flow.

**Independent Test**: mark Monday windows as on request, open the available terms, choose a
Monday window, complete checkout; a request (not a paid order) is created, holds a place in
Monday's capacity and the customer sees its status.

**Acceptance Scenarios**:

1. **Given** Monday windows marked on request, **When** the customer looks at available terms,
   **Then** Monday windows are offered with a clear "requires the kitchen's confirmation, you
   pay after it" label, distinct from standard terms.
2. **Given** an on-request term in the cart, **When** the customer reaches the end of
   checkout, **Then** they send a request without any payment step and the button and texts
   say it is a request, not a binding order.
3. **Given** a request was sent, **When** the customer opens its status page, **Then** they see
   "awaiting the kitchen's confirmation" with the deadline for the answer.
4. **Given** the minimum order value or invoice data are not met, **When** the customer sends
   the request, **Then** it is rejected with the same messages as a standard order.
5. **Given** the daily capacity of that Monday is used up (by orders and pending requests),
   **When** the customer looks at terms, **Then** the day is not offered.
6. **Given** a standard (not on-request) window in the cart, **When** the order is sent
   without payment as a request, **Then** it is refused and the customer must pay as usual;
   **and given** an on-request window, **When** an immediate paid order is attempted,
   **Then** it is refused and only a request can be sent.

---

### User Story 2 - Staff confirm or decline a request (Priority: P1)

Staff see new requests in the pickup calendar and on the order, and confirm or decline each
one. A confirmed request lets the customer pay; a declined one frees the place and the
customer learns about it.

**Why this priority**: the kitchen's decision is the purpose of the feature; without it
requests would never turn into orders.

**Independent Test**: create a request, confirm it in the Admin → the customer's status page
offers payment; create another, decline it → its place is free again and the status page says
it was declined.

**Acceptance Scenarios**:

1. **Given** a pending request, **When** staff open the pickup calendar or the order, **Then**
   it is clearly marked as a request awaiting decision, with the time left to answer.
2. **Given** a pending request, **When** staff confirm it, **Then** its status becomes
   "confirmed — awaiting payment" with the payment deadline, and the customer can pay.
3. **Given** a pending request, **When** staff decline it, **Then** it is closed, its place in
   the daily capacity is released and the customer sees that the kitchen could not accept it.
4. **Given** a request whose response time has already passed, **When** staff try to confirm
   it, **Then** the action is refused because the request has expired.

---

### User Story 3 - Customer pays for a confirmed request (Priority: P1)

After the confirmation the customer pays for exactly that order from its status page; only
then is the order final.

**Why this priority**: the order is binding and the kitchen produces only after payment.

**Independent Test**: confirm a request, pay for it from its status page → the order is paid
and final; try to pay for an unconfirmed or expired request → refused.

**Acceptance Scenarios**:

1. **Given** a confirmed request within its payment time, **When** the customer pays from the
   status page, **Then** the order is paid and final and the status page shows it as accepted.
2. **Given** a pending (not yet confirmed) request, **When** the customer tries to pay,
   **Then** payment is not possible.
3. **Given** a confirmed request whose payment time has passed, **When** the customer tries to
   pay, **Then** payment is refused and the page says the order was cancelled for lack of
   payment.
4. **Given** the payment step after confirmation, **When** the customer pays, **Then** it
   carries the same legal information and "order with obligation to pay" wording as a
   standard checkout.

---

### User Story 4 - Unanswered and unpaid requests expire automatically (Priority: P1)

If staff do not answer in time, or the customer does not pay in time after confirmation, the
request ends by itself, the place is released and the customer is informed.

**Why this priority**: otherwise forgotten requests would block the kitchen's capacity
indefinitely.

**Independent Test**: set short response/payment times, let a request pass each deadline; it
moves to expired / cancelled, the day's capacity is released, and the status page explains it.

**Acceptance Scenarios**:

1. **Given** a pending request not answered within the response time, **When** the deadline
   passes, **Then** the request expires, its place is released and its status page says the
   kitchen did not answer in time.
2. **Given** a confirmed request not paid within the payment time, **When** the deadline
   passes, **Then** the order is cancelled, its place is released and its status page says it
   was cancelled for lack of payment.
3. **Given** an expiry happened, **When** staff look at the calendar, **Then** the request is
   no longer counted and is shown as expired / cancelled on the order.

---

### User Story 5 - Staff configure on-request terms (Priority: P2)

In the pickup schedule staff mark which windows are on request and set the lead time for
requests, the response time and the payment time.

**Why this priority**: required to run the feature without a developer, but sensible defaults
let US1–US4 be tested first.

**Independent Test**: mark Monday as on request and change the four values in the Admin; the
terms offered to customers and new deadlines follow immediately.

**Acceptance Scenarios**:

1. **Given** the pickup schedule in the Admin, **When** staff mark a window (or all windows of
   a weekday) as on request, **Then** customers see it as on request from then on.
2. **Given** staff change the lead time for requests, **When** customers look at terms,
   **Then** on-request windows inside that lead time are not offered, independently of the
   standard lead time.
3. **Given** staff change the response or payment time, **When** a new request is sent or
   confirmed, **Then** its deadline uses the new value; existing deadlines stay as they were.

### Edge Cases

- A request's deadlines may not run past the term itself: the response deadline and the
  payment deadline are capped so that both end before the start of the pickup window; with a
  sensible lead time for requests this cap rarely applies.
- A window is changed from on request to standard (or back) while requests exist: existing
  requests and orders keep their state; only new choices follow the new setting.
- Staff block a date with pending or confirmed requests: they are warned (as for orders); the
  requests stay until confirmed, declined or expired.
- Staff reschedule a request (spec 004 US5): allowed with the same warnings; it keeps its
  state and deadlines.
- The customer sends a second request for the same day: treated like any other request.
- A request is cancelled by staff after confirmation but before payment: same effect as a
  decline (place released, customer informed).
- The expiry check runs late (e.g. server restart): it catches up, and payment is refused for
  anything past its deadline even before the check has run.
- Time zone: all deadlines are computed and shown in Polish local time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Staff MUST be able to mark individual pickup windows (and all windows of a
  weekday at once) as "on request" in the Admin; marking is per fulfillment method so delivery
  can get the same option later.
- **FR-002**: The available terms MUST tell the storefront, per window, whether it is on
  request, so the shop can label it; on-request windows MUST follow their own minimum lead
  time instead of the standard one, plus all other rules (horizon, blocked dates, capacity).
- **FR-003**: Choosing an on-request term MUST lead to sending a request without any payment;
  the same order rules as for standard orders (minimum order value, invoice data, term
  validity, capacity under concurrency) MUST be enforced when the request is sent.
- **FR-003a**: The path is decided by the chosen window alone, as configured by staff at the
  moment the customer sends the order: a window marked "on request" MUST go through the
  request path (no payment at checkout), and every other window MUST go through the standard
  path with payment. The customer and the storefront MUST NOT be able to choose the other
  path — the backend MUST refuse a request without payment for a standard window and MUST
  refuse an immediate payment-and-order for an on-request window.
- **FR-004**: A request MUST take a place in the day's capacity from the moment it is sent and
  keep it while pending or confirmed; declined, expired and cancelled requests MUST NOT count.
- **FR-005**: Each request MUST have a state: pending → confirmed → paid, or declined, expired
  (not answered in time) or cancelled (not paid in time, or cancelled by staff); the backend
  MUST be the only place that changes it.
- **FR-006**: Staff MUST be able to confirm or decline a pending request in the Admin from the
  pickup calendar and from the order; confirming or declining an expired request MUST be
  refused.
- **FR-007**: Confirmation MUST set a payment deadline (now + payment time, capped before the
  pickup window); the response deadline MUST be set when the request is sent (now + response
  time, capped likewise).
- **FR-008**: The customer MUST be able to pay for a confirmed request within its payment time
  from a status page unique to that order; payment MUST be refused for a request that is
  pending, declined, expired, cancelled or past its payment deadline.
- **FR-009**: A pending request past its response deadline MUST become expired, and a
  confirmed request past its payment deadline MUST become cancelled, automatically and
  without staff action; both MUST release capacity.
- **FR-010**: The customer MUST be informed of every state change (confirmed with the payment
  deadline, declined, expired, cancelled) on the order's status page; e-mail notification is
  added by the transactional e-mail feature.
- **FR-011**: Staff MUST be able to set in the Admin: the lead time for requests (hours), the
  response time (hours, default 24) and the payment time (hours, default 24).
- **FR-012**: The storefront texts and the status page MUST make clear that a request is not a
  binding order and that payment happens only after confirmation (constitution II, IV).
- **FR-013**: Standard (not on-request) terms MUST behave exactly as before.
- **FR-014**: The Store API changes MUST be documented in `contracts/` and be non-breaking for
  the existing storefront (a new per-window flag, new routes).

### Key Entities

- **Window rule** (from 004): gains an "on request" flag.
- **Scheduling settings** (from 004, per fulfillment method): gain the lead time for
  requests, the response time and the payment time.
- **Request** — the state of an order placed for an on-request term: state, response
  deadline, payment deadline, decision time and who decided; tied to the order and to its
  capacity record (booking).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No request or unpaid confirmed order ever holds capacity beyond its deadline by
  more than 15 minutes, and none can be paid after its deadline — verified by automated tests
  of confirmation, decline and both expiries.
- **SC-002**: A customer can send a request for an on-request term in the same time as a
  standard order minus the payment step, and understands from the shop alone that they pay
  only after confirmation.
- **SC-003**: Staff can confirm or decline a request from the calendar in under 30 seconds.
- **SC-004**: Staff can mark a weekday as on request and change the three times without a
  developer, effective immediately.
- **SC-005**: Standard orders are unaffected: all existing 004 tests keep passing.

## Assumptions

- Default lead time for requests: 72 h (editable), so that both 24 h deadlines fit before the
  pickup; the standard 48 h stays for standard terms.
- Payment in this feature uses the existing test payment; Przelewy24 (a later feature) must
  support paying an existing confirmed order. E-mail notifications come with the e-mail
  feature; until then the status page is the customer's channel.
- The status page is reached through the link shown after sending the request (unique,
  unguessable order link); customer accounts are not required.
- The customer cannot withdraw a request themselves in this feature (they contact the venue;
  staff decline it).
- Expiry runs as a periodic check (at most every few minutes) and payment always re-checks the
  deadline, so a late check never allows a late payment.
- The kitchen-wide daily capacity from 004 is shared by standard orders and requests.
