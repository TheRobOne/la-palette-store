# Feature Specification: Pickup Scheduling

**Feature Branch**: `004-pickup-scheduling`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Zamówienie cateringowe jest składane na konkretny termin odbioru
osobistego: klient wybiera datę i przedział godzinowy (slot). Dostępne terminy uwzględniają
minimalny czas wyprzedzenia (np. 48h), dni zablokowane (wesela, święta, urlopy), godziny pracy
kuchni i dzienne limity pojemności. Klient widzi tylko dostępne terminy. Termin jest zapisany w
zamówieniu i widoczny dla obsługi w panelu admina, w tym w kalendarzu odbiorów. Obsługa
zarządza godzinami, slotami, dniami zablokowanymi i limitami w panelu admina. Backend odrzuca
zamówienie na termin niedostępny w chwili finalizacji, także przy wyścigu dwóch klientów o
ostatnie miejsce. Model terminów musi pozwolić w przyszłości dodać dowóz z własnymi slotami bez
przebudowy."

## Clarifications

### Session 2026-10-06

- Q: Unit of the daily capacity — orders, portions/pieces, or order value? → A: number of
  orders per day.
- Q: Is rescheduling by staff in scope, and may staff exceed capacity or lead time? → A: yes,
  in scope; staff may always reschedule, with a warning when the new term exceeds the day's
  capacity or is inside the lead time (or on a blocked date / outside the windows).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer orders for a pickup date and time slot (Priority: P1)

A customer finishing an order for an event chooses the day and the time window in which they
will collect it at La Palette Garden. They are only offered days and windows the kitchen can
actually serve; the chosen term is part of the placed order.

**Why this priority**: event catering is ordered for a date; without a pickup term the kitchen
cannot plan and no order can be fulfilled. This is the minimum viable slice.

**Independent Test**: with a default schedule configured, request the available terms for the
next weeks, pick one, attach it to a cart and place the order; the order carries that date and
slot, and terms inside the lead time are never offered.

**Acceptance Scenarios**:

1. **Given** a schedule with pickup windows on working days and a 48 h lead time, **When** the
   customer asks for available terms, **Then** only windows starting at least 48 h from now,
   on days the kitchen works, are offered.
2. **Given** the customer selected an available window, **When** the order is placed, **Then**
   the order stores the pickup date and window and the customer sees them in the confirmation.
3. **Given** a cart without a selected term, **When** the customer tries to place the order,
   **Then** it is rejected with a clear message asking to choose a pickup term.
4. **Given** a window that was available when selected but is now inside the lead time,
   **When** the customer places the order, **Then** it is rejected with a message asking to
   choose another term.

---

### User Story 2 - The kitchen is never overbooked (Priority: P1)

Each day has a capacity limit. Once a day is full, it is no longer offered, and two customers
competing for the last place can never both succeed.

**Why this priority**: an overbooked day means an order the kitchen cannot deliver — a direct
loss of money and trust (Principle VI/VIII).

**Independent Test**: set a day's capacity to 1, place one order for that day, then check that
the day is no longer offered; complete two carts for the last place at the same moment and
verify exactly one order is created.

**Acceptance Scenarios**:

1. **Given** a day whose capacity is used up by placed orders, **When** the customer asks for
   available terms, **Then** that day is not offered.
2. **Given** one free place left on a day, **When** two customers place orders for that day at
   the same time, **Then** exactly one order is placed and the other customer is told the term
   is no longer available and asked to choose another.
3. **Given** a placed order for a day is cancelled, **When** customers ask for available terms,
   **Then** its place is free again.

---

### User Story 3 - Staff manage the schedule, blocked days and limits (Priority: P1)

Staff define in the Admin when pickups are possible (weekly working hours and windows per day
of the week), the lead time, the daily capacity, and days on which nothing can be ordered
(weddings, holidays, leave). Changes apply immediately to what customers are offered.

**Why this priority**: the venue regularly hosts weddings and closes for holidays; without
self-service blocking staff would need a developer for every change (Principle VII).

**Independent Test**: in the Admin, block a date, change Saturday's windows and the daily
capacity; the available terms change accordingly without a deploy.

**Acceptance Scenarios**:

1. **Given** staff block a date with a reason (e.g. "Wesele"), **When** customers ask for
   available terms, **Then** that date is not offered.
2. **Given** staff change the windows for a day of the week, **When** customers ask for
   available terms, **Then** the new windows are offered for future dates of that weekday.
3. **Given** staff change the lead time or the daily capacity, **When** customers ask for
   available terms, **Then** the new values are applied.
4. **Given** staff block a date that already has placed orders, **When** they save, **Then**
   they are warned how many orders exist on that date, and those orders stay unchanged.

---

### User Story 4 - Staff see pickups in a calendar (Priority: P2)

Staff see the pickup term on every order and a calendar of upcoming pickups grouped by day and
window, with how much of each day's capacity is used, so the kitchen can plan production.

**Why this priority**: important for daily operations, but orders can be handled from the
order list until it exists.

**Independent Test**: place orders on several days; the calendar shows each day with its
orders per window and the used/total capacity, and each order's detail shows its term.

**Acceptance Scenarios**:

1. **Given** placed orders on several days, **When** staff open the pickup calendar, **Then**
   they see the days with orders grouped by window, the used/total capacity per day and blocked
   days marked as such.
2. **Given** an order with a pickup term, **When** staff open the order, **Then** they see the
   pickup date and window.
3. **Given** a staff member clicks an order in the calendar, **When** the order opens, **Then**
   it is the same order shown in the calendar.

---

### User Story 5 - Staff reschedule an order (Priority: P3)

When a customer calls to move their pickup, staff change the order's date and window in the
Admin. Staff know the kitchen, so they may override the customer rules, but are warned first.

**Why this priority**: happens occasionally; staff can cancel and recreate an order as a
workaround until it exists.

**Independent Test**: change an order's term in the Admin, once to a free term and once to a
full day; the order and the calendar show the new term, capacity moves from the old day to the
new one, and the full day triggers a warning before saving.

**Acceptance Scenarios**:

1. **Given** a placed order, **When** staff move it to another available term, **Then** the
   order and the calendar show the new term and the capacity of both days is updated.
2. **Given** a target day that is full, blocked, outside the windows or inside the lead time,
   **When** staff choose it, **Then** they see a warning naming the broken rule and can still
   confirm the change.
3. **Given** a rescheduled order, **When** staff open it, **Then** they can see the previous
   term and when it was changed.

---

### Edge Cases

- Time zone: all dates, windows and the lead time are in Polish local time (Europe/Warsaw),
  including the days when the clock changes; a window never appears twice or disappears
  because of daylight saving time.
- Lead time is measured to the **start** of the window: a window 10:00–11:00 two days ahead is
  available until 10:00 today with a 48 h lead time.
- The customer keeps a cart open for a long time: availability is checked again when the order
  is placed, not only when the term is chosen.
- The term becomes unavailable while the customer is paying (another order took the last
  place, staff blocked the day): the order is not placed, any payment taken is returned
  automatically, and the customer is told to choose another term.
- Capacity lowered below the number of already placed orders on a day: existing orders stay;
  the day simply stops being offered.
- Schedule changed (windows removed) after orders were placed for those windows: existing
  orders keep their term and remain visible in the calendar.
- A blocked date in the past or a date with no working windows: never offered.
- How far ahead terms are offered is limited (booking horizon), so the customer is not offered
  dates years ahead.
- An empty schedule (nothing configured yet): no terms are offered and ordering is impossible,
  with a clear message, rather than accepting orders for any time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The customer MUST choose a pickup date and window before an order can be placed;
  an order without a term MUST be rejected.
- **FR-002**: The system MUST offer customers only terms that are, at the moment of asking:
  within the booking horizon, at least the lead time ahead of the window start, on a day that
  is not blocked, within the configured windows for that weekday, and on a day with free
  capacity.
- **FR-003**: The system MUST re-check all rules of FR-002 at the moment the order is placed
  and reject the order with a customer-readable Polish message if the term is no longer
  available (Principle VIII).
- **FR-004**: Concurrent orders for the same day MUST NOT exceed the day's capacity: when two
  orders compete for the last place, exactly one succeeds.
- **FR-005**: If an order is rejected after the customer's payment was taken, the payment MUST
  be returned automatically and the customer told to choose another term.
- **FR-006**: The pickup date and window MUST be stored on the placed order and returned to the
  customer with the order (confirmation, order history).
- **FR-007**: Staff MUST be able to configure in the Admin, without a deploy: the windows for
  each day of the week, the lead time (in hours), the daily capacity, and the booking horizon
  (in days).
- **FR-008**: Staff MUST be able to block and unblock individual dates with an optional reason;
  blocking a date with placed orders MUST show how many orders exist and MUST NOT change them.
- **FR-009**: Daily capacity MUST be counted as the number of placed orders per day, regardless
  of their size; cancelled orders MUST NOT count.
- **FR-010**: Staff MUST see each order's pickup term on the order and in a pickup calendar
  showing upcoming days, their orders grouped by window, used/total capacity and blocked days.
- **FR-011**: Every term rule (windows, lead time, horizon, blocked dates) MUST be defined per
  fulfillment method, with pickup as the only method now, so that delivery can later get its
  own windows and rules without changing how pickup works; the daily capacity is shared by all
  methods because it reflects the kitchen's production.
- **FR-012**: All times MUST be interpreted in Polish local time (Europe/Warsaw), correctly
  across daylight-saving changes.
- **FR-013**: The storefront MUST be able to read available terms for a date range and attach
  the chosen term to the cart through a documented contract (Principle VIII, contracts/).
- **FR-014**: Before any staff configuration exists, a default schedule MUST be provided by the
  setup scripts so that a fresh environment can take orders (values in Assumptions).
- **FR-015**: Staff MUST be able to change the pickup term of a placed order in the Admin. A
  change to a term that breaks a customer rule (full day, blocked date, outside the windows,
  inside the lead time) MUST show a warning naming the rule and MUST be allowed after
  confirmation. The previous term and the time of the change MUST stay visible on the order.

### Key Entities

- **Pickup window rule**: a recurring time window on a given day of the week for a fulfillment
  method (e.g. pickup, Saturday 10:00–11:00). The set of rules for all weekdays is the weekly
  schedule.
- **Blocked date**: a calendar date on which no orders can be placed for a fulfillment method,
  with an optional reason visible only to staff.
- **Scheduling settings**: lead time, booking horizon and daily capacity; lead time and
  horizon per fulfillment method, capacity kitchen-wide.
- **Pickup term**: the date and window chosen for an order; first on the cart, then on the
  placed order; counted against the day's capacity while the order is not cancelled.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No placed order ever has a term that was blocked, inside the lead time, outside
  the configured windows, or on a day that was already full at the moment it was placed —
  verified by automated tests including a concurrent "last place" scenario.
- **SC-002**: A staff change (blocked date, windows, lead time, capacity) is reflected in the
  terms offered to customers within 1 minute, without a deploy.
- **SC-003**: A customer can see the available terms for the next 4 weeks and choose one in
  under 30 seconds on a phone.
- **SC-004**: Staff can block a date or change a day's windows in the Admin in under 1 minute.
- **SC-005**: Staff can see all pickups of a given day, grouped by window, in a single view.

## Assumptions

- Default schedule (editable by staff, set by the setup scripts): pickups Tuesday–Sunday,
  hourly windows 10:00–18:00, lead time 48 h, booking horizon 60 days, daily capacity 10.
- Blocking works on whole days; partial-day blocks are out of scope (staff can remove windows
  for a weekday instead).
- Capacity is counted per day in orders (clarified); there is no separate per-window limit in
  this feature. A rescheduled order counts on its new day only.
- The order is created only when payment succeeds; capacity is therefore taken by placed,
  non-cancelled orders, and a cart with a selected term does not reserve a place.
- Delivery is not offered at launch (constitution 2.2.0); this feature only has to make adding
  it possible, not implement it.
- The storefront (la-palette-garden) builds the term picker against the contract from this
  feature; its UI is out of scope here.
- The minimum order value and invoice rules already enforced at order placement remain
  unchanged; the term rules are added to the same order-placement checks.
