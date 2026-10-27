# Feature Specification: City Delivery in Postal-Code Zones

**Feature Branch**: `feat/delivery-zones`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "City delivery in postal-code zones, offered at launch alongside
pickup (constitution v2.4.0). Customer chooses pickup or delivery in the fulfillment-method
step; for delivery gives an address; postal code determines the zone and the delivery price,
shown in the cart as soon as the postal code is known and validated by the backend before
payment. Zones, their postal codes (exact codes or prefixes) and prices are managed in the
Admin without a deploy; pickup setup unchanged. Address outside every zone → on-request path
from 005: kitchen confirms and sets the delivery cost, or declines; then customer pays.
Delivery has its own windows, lead time and blocked dates per method (from 004), daily
capacity shared with pickup. Optional per-zone minimum order value (empty = global 100 zł) and
optional free-delivery threshold (empty = none). Transactional e-mails from 006 must show
delivery address and delivery window instead of pickup info for delivery orders. Open
business questions for the manager — zone data is Admin data, not code."

## Clarifications

### Session 2026-10-27

- Q: Free delivery from an order value? → A: one optional threshold for all zones, empty
  (off) at launch.
- Q: Where are out-of-zone delivery requests accepted from? → A: any valid Polish postal
  code; the kitchen declines what it cannot serve.
- Q: Who delivers, and does it limit deliveries? → A: the venue's own driver; staff set a
  maximum number of deliveries per delivery window in the Admin, on top of the shared daily
  capacity.
- Q: Postal code prefixes (e.g. "31-7")? → A: no — a zone is a list of full postal codes
  `XX-XXX` only; the storefront validates the `XX-XXX` format before asking for a price (the
  backend still rejects anything else).
- Note: the venue is at the Kraków city border, so zones (including the first one) contain
  postal codes outside Kraków; zones are not tied to a city.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer orders with delivery to an address in a zone (Priority: P1)

A customer planning an event at home or in an office chooses "delivery" instead of "pickup" in
checkout, enters the delivery address and sees at once which zone it falls in and how much
delivery costs. They pick a delivery date and window, see the total with delivery in the cart
and pay. The kitchen receives an order with the address, window and delivery cost.

**Why this priority**: delivery is offered from launch; without this path a customer who
cannot pick up cannot order at all.

**Independent Test**: with one zone configured, place an order with a postal code from that
zone and check that the order carries the address, the delivery window and the zone's price,
and that the total paid includes it.

**Acceptance Scenarios**:

1. **Given** a zone containing postal code 30-001 priced 30 zł, **When** the customer chooses
   delivery and enters 30-001, **Then** the cart shows delivery 30 zł and a total including it
   before the payment step.
2. **Given** the customer has entered a postal code, **When** they change it to a code in
   another zone, **Then** the delivery price and total update to that zone's price.
3. **Given** the customer switches from delivery back to pickup, **Then** the delivery cost
   disappears and the pickup windows are offered instead of delivery windows.
4. **Given** a cart with a postal code that was in a zone, **When** staff remove that code from
   the zone before the customer pays, **Then** placing the order is refused with a Polish
   message and the customer sees the new situation (other zone price or on-request path).
5. **Given** a delivery order is placed, **Then** staff see it in the calendar in its delivery
   window together with the address, contact phone and zone.

---

### User Story 2 - Staff manage zones and prices in the Admin (Priority: P1)

The manager decides the zones (e.g. "Zone 1 — up to about 10 km", "Zone 2 — up to about
20 km"). Staff enter each zone in the Admin: its name, the list of full postal codes it
covers (pasted as a list), the delivery price and optionally a minimum order value. Changes
apply to new carts at once, without a developer.

**Why this priority**: prices and zone borders will change after the manager's decision and
over time; a deploy for every change would block the shop.

**Independent Test**: create a zone with code 30-045, set its price, and check that a cart
with postal code 30-045 gets that price; change the price and check that a new cart gets the
new one.

**Acceptance Scenarios**:

1. **Given** staff create a zone with a list of postal codes, **When** a cart's postal code is
   on that list, **Then** the customer gets that zone's price.
2. **Given** staff paste a list containing an entry that is not a full `XX-XXX` code, **Then**
   the Admin refuses to save and names the invalid entries.
3. **Given** staff try to save a code already used by another zone, **Then** the Admin refuses
   and names the zone that already has it.
4. **Given** staff change a zone's price, **Then** placed orders keep the price they were paid
   with, and only carts priced from then on use the new price.

---

### User Story 3 - Address outside every zone goes to the kitchen for a decision (Priority: P2)

A customer from outside the zones still wants catering delivered. Instead of a dead end the
shop explains that delivery to this address needs the kitchen's confirmation and that the
delivery cost will be given with it. The customer sends a request without paying. Staff
confirm it with a delivery cost (or decline), and the customer pays the products plus that
cost.

**Why this priority**: large event orders from just outside the city are valuable, but they
are rarer than in-zone orders, and the on-request path from 005 already exists.

**Independent Test**: send a delivery request with a postal code in no zone; confirm it in
the Admin with a delivery cost of 80 zł; check that the payment page shows the total with
80 zł and that the paid order carries it.

**Acceptance Scenarios**:

1. **Given** a postal code in no zone, **When** the customer enters it, **Then** before
   sending anything they are told that delivery needs the kitchen's confirmation, that the
   delivery cost will be given with it and that they pay only afterwards.
2. **Given** an out-of-zone request is pending, **When** staff confirm it, **Then** they MUST
   enter a delivery cost (0 zł allowed); confirming without a cost is refused.
3. **Given** a confirmed out-of-zone request, **When** the customer opens the status page,
   **Then** they see the delivery cost and the total before paying.
4. **Given** an out-of-zone request, **Then** it follows all 005 rules: it holds capacity,
   expires without a response, is cancelled without payment in time, and releases capacity.

---

### User Story 4 - Delivery has its own schedule (Priority: P2)

The kitchen may deliver at different hours than it hands over pickups (e.g. delivery windows
of two hours, a longer lead time, no deliveries on Sundays). Staff set a separate weekly
schedule, lead time, booking horizon and blocked dates for delivery, while the daily capacity
stays shared because it reflects the kitchen's production.

**Why this priority**: delivery needs travel and a driver, so its hours differ from pickup;
the scheduling engine from 004 already supports per-method rules.

**Independent Test**: set delivery windows only on Saturdays and block delivery on one
Saturday; check that pickup windows are unchanged, that delivery offers only the other
Saturdays, that an order of either method uses the same daily capacity, and that a delivery
window stops being offered once it holds the maximum number of deliveries.

**Acceptance Scenarios**:

1. **Given** delivery and pickup have different windows, **When** the customer chooses a
   method, **Then** only that method's windows are offered.
2. **Given** a date is blocked for delivery only, **Then** delivery is not available that day
   but pickup is.
3. **Given** a day with one free place, **When** a pickup order and a delivery order compete
   for it, **Then** exactly one succeeds.
4. **Given** delivery windows marked "on request" (005), **Then** in-zone delivery on such a
   window goes through the request path with the zone's price already known.
5. **Given** a maximum of 2 deliveries per window and a window holding 2 delivery orders or
   pending/confirmed delivery requests, **Then** that window is not offered for delivery,
   while other windows of the same day and pickup are still offered if the day has capacity.
6. **Given** a delivery window with one free delivery place, **When** two delivery orders
   compete for it, **Then** exactly one succeeds.

---

### User Story 5 - E-mails and the Admin speak about delivery (Priority: P2)

For a delivery order every message says "delivery", not "pickup": the order confirmation,
the reminder the day before, the change-of-term e-mail, the request e-mails and the staff
alerts show the delivery address, window and cost.

**Why this priority**: a delivery customer told to "come and pick up" would be confused and
might come to the venue.

**Independent Test**: place a delivery order and check the confirmation, staff alert and
reminder for the address, window and delivery cost, and the absence of pickup wording.

**Acceptance Scenarios**:

1. **Given** a delivery order, **Then** the confirmation shows the delivery address, the
   delivery window and the delivery cost as a separate line.
2. **Given** a delivery order for tomorrow, **Then** the reminder speaks of delivery to the
   address, not pickup at the venue.
3. **Given** staff reschedule a delivery order, **Then** the change-of-term e-mail shows the
   new delivery window and the address.

---

### Edge Cases

- A postal code not in the `XX-XXX` format (e.g. "30001", "30 001", "31-7") → the storefront
  asks for a correct code before showing a price; if it reaches the backend anyway, the quote
  answers "invalid" and the order or request is refused.
- A street address whose city does not match the postal code → accepted; the postal code
  decides the zone (the kitchen can still decline a request or contact the customer).
- Free-delivery threshold reached and then the cart is reduced below it → delivery cost comes
  back before payment.
- A per-zone minimum higher than the global minimum → the higher one applies; a zone
  minimum lower than the global one has no effect (the global minimum always applies).
- The customer changes method or postal code after choosing a window → a window that is not
  valid for the new method is cleared and the customer chooses again.
- Staff change an order's delivery address in the Admin to a code in another zone → the paid
  delivery cost is not changed automatically; staff settle any difference outside the shop.
- All zones deleted → delivery to any address goes through the on-request path; pickup is
  unaffected.
- Staff want to pause delivery (e.g. no driver) → they block delivery dates; pickup stays
  open.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The customer MUST choose a fulfillment method, pickup or delivery, before
  choosing a term; delivery MUST NOT change how pickup works (constitution II, Stack →
  Fulfillment).
- **FR-002**: For delivery the customer MUST give a delivery address (street and number, postal
  code, city) and a contact phone number; an order or request with delivery and without them
  MUST be refused.
- **FR-003**: The delivery zone MUST be decided by the postal code alone: the zone whose list
  contains the cart's postal code exactly. Only full codes in the `XX-XXX` format are accepted;
  any other value MUST be treated as invalid (no price, order refused).
- **FR-004**: As soon as the postal code is known, the storefront MUST be able to read the zone
  and the delivery price, or the information that the address is outside every zone, and show
  it in the cart (constitution II).
- **FR-005**: The backend MUST recompute the zone and the delivery price when the order or
  request is placed and refuse it with a Polish message if the cart's delivery price no longer
  matches (constitution VIII).
- **FR-006**: The delivery price MUST be stored on the order as a separate line in PLN gross
  and included in the total paid; later zone changes MUST NOT alter placed orders.
- **FR-007**: Staff MUST be able, in the Admin and without a deploy, to create, edit and
  delete zones: name, list of postal codes (pasted as a list), delivery price (PLN gross) and
  an optional minimum order value. Saving an entry that is not a full `XX-XXX` code, or a code
  that already belongs to another zone, MUST be refused with the entries named.
- **FR-008**: The minimum order value for a delivery order MUST be the higher of the global
  minimum and the zone's minimum, if set; it MUST be validated before payment and shown in the
  cart like the global minimum.
- **FR-009**: Staff MUST be able to set one optional free-delivery threshold for all zones;
  when the product total (gross, after discounts) reaches it, the in-zone delivery price MUST
  be 0 zł. Empty means no free delivery (the launch value). The threshold does not apply to
  out-of-zone requests, whose cost staff set.
- **FR-010**: A delivery address outside every zone MUST go through the on-request path of
  005: shown before sending, request without payment, staff confirm with a delivery cost (0 zł
  allowed) or decline, then the customer pays the request's contents plus that cost. All 005
  rules (capacity, deadlines, expiry, contents fixed) apply unchanged.
- **FR-011**: Out-of-zone requests MUST be accepted for any valid Polish postal code; the
  kitchen declines what it cannot serve.
- **FR-012**: Delivery MUST have its own weekly windows, lead time, booking horizon, blocked
  dates and blocked periods, and its own "on request" window marks, configured per method as
  provided by 004/005; the daily capacity MUST stay shared by both methods.
- **FR-012a**: Staff MUST be able to set in the Admin, without a deploy, the maximum number of
  deliveries per delivery window (the venue's own driver). A delivery window MUST be offered
  only while both the window has a free delivery place and the day has free capacity. Placed
  delivery orders and pending or confirmed delivery requests (in-zone and out-of-zone) count
  against the window; cancelled, declined and expired ones do not. Under concurrency the
  limit MUST hold like the daily capacity (exactly one of two competing orders succeeds), and
  the backend MUST re-check it when the order or request is placed.
- **FR-012b**: Lowering the per-window maximum MUST NOT change existing orders; a window that
  is over the new maximum is simply not offered any more. Staff moving a delivery order into
  a full window (004 FR-015) MUST get a warning naming the rule and MAY confirm.
- **FR-013**: The fulfillment method, delivery address, phone, zone name and delivery cost MUST
  be visible to staff on the order, on the request, and in the calendar next to the delivery
  window.
- **FR-014**: Staff changing the term of a delivery order (004 FR-015) MUST be offered
  delivery windows and warned by delivery rules.
- **FR-015**: For delivery orders and requests, every customer e-mail from 006 (order
  confirmation, request state changes, change of term, cancellation, reminder) and the staff
  alerts MUST show the delivery address, the delivery window and the delivery cost instead of
  pickup information; pickup e-mails MUST stay as they are.
- **FR-016**: The Store API changes (method choice, address, zone and price lookup, out-of-zone
  information, delivery cost on requests) MUST be documented in `contracts/` and be
  non-breaking for the existing pickup checkout (constitution VIII).
- **FR-017**: A fresh environment MUST get the delivery method set up by the setup scripts,
  with example zones and a delivery schedule (values in Assumptions), so that delivery can be
  tested before staff enter real data.

### Key Entities

- **Delivery zone**: name, list of full postal codes, delivery price (PLN gross), optional
  minimum order value. Each postal code belongs to at most one zone.
- **Delivery settings**: optional free-delivery threshold; maximum number of deliveries per
  delivery window.
- **Delivery term**: the date and delivery window of an order; like the pickup term of 004,
  counted against the shared daily capacity.
- **Delivery details on an order or request**: address, contact phone, matched zone (or "out
  of zone") and delivery cost — for an out-of-zone request set by staff on confirmation.
- **Scheduling settings, window rules, blocked dates** (from 004/005): now also used for the
  delivery method.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A customer with an in-zone address sees the delivery price in the cart within
  2 seconds of entering the postal code, before reaching the payment step.
- **SC-002**: 100% of placed delivery orders carry the address, phone, delivery window and the
  delivery cost that the customer saw before paying.
- **SC-003**: No order is placed with a delivery price that differs from the zone's price at
  the moment of placing, or below the applicable minimum order value (verified by tests that
  change zones between cart and order).
- **SC-004**: Staff can add a new zone or change a price in under 5 minutes without a
  developer, and the change applies to the next customer's cart.
- **SC-005**: A customer outside the zones can send a request in the same number of steps as
  an in-zone customer, and is never shown a dead end.
- **SC-006**: Pickup orders behave exactly as before: all existing pickup tests pass
  unchanged.
- **SC-007**: No delivery window ever holds more deliveries than its maximum through the shop,
  including when orders are placed at the same moment (verified by a concurrency test).

## Assumptions

- **Zone data is Admin data, not code.** Until the manager decides, setup scripts create two
  example zones for testing: "Strefa 1" around the venue at 31-762 Kraków, which sits at the
  city border — a few Kraków codes near the venue (e.g. 31-762, 31-763, 31-764) plus codes of
  neighbouring places outside Kraków such as 32-005 (Niepołomice), 32-010
  (Kocmyrzów-Luborzyca) and 32-020 (Wieliczka) — at 30 zł, and "Strefa 2" (a few central
  Kraków codes, e.g. 30-001, 31-001) at 50 zł; no per-zone minimums, no free-delivery
  threshold, at most 2 deliveries per window. Real zones, code lists, prices and the
  per-window maximum are entered by staff after the manager's decision.
- Because zones mix Kraków and neighbouring municipalities, a zone is defined only by postal
  codes, never by city name.
- The manager thinks in kilometres ("up to 10 km"); staff translate each radius into a list
  of full postal codes once (a zone may hold a few hundred codes, pasted as a list). Distance is never computed by the system (constitution,
  Stack → Fulfillment).
- Default delivery schedule (editable): the same weekdays as pickup, windows of two hours
  between 10:00 and 18:00, lead time 48 h like pickup, the same booking horizon.
- A delivery window is the time within which the order arrives at the address.
- Delivery covers bringing the order to the address; serving, setting up a buffet and
  collecting dishes or equipment afterwards are out of scope.
- Delivery is to Polish addresses only, in the existing Poland region and PLN.
- The delivery price is a flat price per zone; it does not depend on order size or weight.
- The customer gives the delivery address in checkout (no address book, no customer accounts
  needed); billing/invoice data from the existing checkout stay separate from the delivery
  address.
- Payment uses the same payment step as pickup orders; Przelewy24 is a later feature.
- Open questions for the manager (also in `docs/do-omowienia-z-managerem.md`): number of
  zones, their radii or postal codes and prices, delivery windows and lead time, per-zone
  minimums, the free-delivery threshold value (if any), and the maximum deliveries per
  window for the driver.
