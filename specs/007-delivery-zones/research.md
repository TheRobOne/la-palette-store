# Research: City Delivery in Postal-Code Zones

All findings verified against the installed Medusa 2.21.1 sources (`@medusajs/fulfillment`,
`@medusajs/core-flows`) and the existing code of features 004–006.

## R-01 — Zone matching: our own zone table, not Medusa `zip` geo zones

**Decision**: zones and their full postal codes live in the catering module
(`delivery_zone`, `delivery_zone_code`); matching is a lookup by code in our code. The
delivery fulfillment set has one service zone with a country geo zone (PL), like pickup.

**Rationale**: in 2.21.1 a `zip` geo zone requires `country_code`, `province_code`, `city` and
`postal_expression` (`FulfillmentModuleService.validateGeoZones`), and option filtering
compares them by **equality** with the cart address (`buildGeoZoneConstraintsFromAddress`:
`postal_expression = shipping_address.postal_code`, `city = shipping_address.city`,
`province_code = shipping_address.province`). Consequences:

- the customer's spelling of the city decides whether delivery is offered: "Krakow" instead
  of "Kraków" finds nothing, and outside Kraków one postal code covers several villages
  (32-005 is not only "Niepołomice"), so the customer's village name never equals the stored
  city;
- a zone crossing the city border (the venue is at the border, clarification 2026-10-27)
  needs one geo zone per (city, code) pair, i.e. guessing every spelling in advance;
- the out-of-zone price set by staff (R-05) needs a per-cart price anyway, which flat
  per-zone options cannot carry.

Full codes only (clarification 2026-10-27, no prefixes) remove the prefix problem, but not the
city equality, so native `zip` zones still cannot decide the zone by postal code alone
(spec FR-003).

**Alternatives considered**: native `zip` geo zones (rejected above); `city` geo zones
(Kraków is one city but zones split it and cross its border); a geocoding / distance API
(excluded by the constitution, Stack → Fulfillment).

**Constitution impact**: Stack → Fulfillment (v2.4.0) names "postal-code (`zip`) geo zones,
with one priced shipping option per zone". This plan needs a PATCH amendment of that bullet
(see plan.md → Constitution Check); the principle behind it (delivery as a separate shipping
fulfillment set, pickup unchanged, no distance pricing) is kept.

## R-02 — Price: one calculated shipping option "Dostawa"

**Decision**: one shipping option "Dostawa" (`type.code: "delivery"`, `price_type:
"calculated"`) served by a small fulfillment provider `catering-delivery`. Its
`calculatePrice` returns the amount our backend already computed and put into the context via
the `setCalculatedShippingPricingContext` hook of `listShippingOptionsForCartWithPricingWorkflow`
(`{ catering_delivery_amount }`), `is_calculated_price_tax_inclusive: true` (gross PLN, like the
region's prices).

**Rationale**:

- module providers resolve only their own module's container, so the provider cannot read the
  catering module; the workflow hook runs in the app container and can;
- the same workflow runs as a step inside `addShippingMethodToCartWorkflow` and
  `refreshCartShippingMethodsWorkflow`, so the hook prices the method on add **and** re-prices
  it automatically on every cart update (postal code change, items crossing the free-delivery
  threshold) — no custom refresh code;
- one option means the storefront never chooses between zone options, and an out-of-zone price
  set by staff (R-05) fits the same mechanism;
- the price lands in Medusa's own cart/order totals, taxes and payment amount.

**Alternatives considered**: one flat option per zone with a shipping-option rule matched by a
`setShippingOptionsContext` value (prices editable in native Admin, but out-of-zone staff
prices would still need a calculated option, and zone data would be split between Medusa
options and our code table); storing the fee as a custom line item (not shipping, breaks
Medusa totals/fulfillment semantics).

**Detail**: `calculateShippingOptionsPrices` runs all providers with `promiseAll`, so a throw
would also break listing pickup. The provider therefore never throws: when no amount can be
given (invalid postal code, out-of-zone without a staff price) it returns `0`, and the
amount is enforced by the completion hook (R-06). The storefront shows the quote from
`GET /store/catering/delivery-quote` (contracts/store-api.md), not the option amount, for those
cases.

## R-03 — Matching rules

**Decision**: full codes only (clarification 2026-10-27). A code is valid when it matches
`^\d{2}-\d{3}$` after trimming whitespace; nothing else is normalised (the storefront validates
`XX-XXX`). Matching = the zone whose list contains the code. Each code is unique across all
zones — DB unique index on `delivery_zone_code.code`.

**Rationale**: the simplest rule there is — one lookup, no precedence; the unique index makes
"one code, one zone" a database guarantee; staff paste lists (comma, space or newline
separated) and get every invalid or taken entry named in one error.

## R-04 — Per-window delivery maximum

**Decision**: `fulfillment_schedule.max_orders_per_window` (nullable; null = no limit; pickup
stays null). Availability counts capacity-holding bookings per (date, method, start, end)
next to the per-date count; a window is available only if both have room. Checked inside the
existing per-date capacity lock (`withCapacityLock`), so the 004 concurrency guarantee covers
it without a new lock.

**Rationale**: the lock is already per date, and a window belongs to one date; one extra
count in `loadSchedulingContext` keeps the pure availability functions the single source for
slots, completion, requests and staff reschedule warnings.

## R-05 — Out-of-zone address = on-request path with a staff price

**Decision**: a delivery cart whose postal code matches no zone is treated like an on-request
window (005): `POST /store/catering/requests` accepts it even for a standard window, the
completion hook refuses to complete it without a confirmed request. Confirming such a request
requires `delivery_cost` (≥ 0), stored on the booking; the confirm workflow then re-adds the
delivery shipping method so the hook re-prices it with that cost, and the cart the customer
pays already has the right total. The snapshot gains the delivery postal code, so changing the
address after sending makes the request unpayable (005 FR-009a).

**Rationale**: reuses the whole 005 state machine, deadlines, e-mails and status page; only the
decision "does this cart need confirmation" gains a second reason.

## R-06 — Enforcement at completion (constitution VIII)

**Decision**: the existing single `completeCartWorkflow.hooks.validate` handler gains, after
the term check order: method ↔ shipping option (`catering_term.method` must equal the cart's
shipping option `type.code`); for delivery: address and phone present, postal code valid,
the effective minimum (max of global and zone minimum) met, and the shipping method amount
equal to the freshly computed quote (zone price / 0 above threshold / confirmed staff cost).
Any mismatch → 400 `invalid_data` with a Polish message. The booking stores the zone id, zone
name, postal code and the paid delivery cost (order history survives zone edits).

**Rationale**: the storefront may skip the quote or keep a stale method; the backend
recomputes at the only moment that matters.

## R-07 — Free-delivery threshold and per-zone minimum storage

**Decision**: threshold in store metadata `catering_free_delivery_threshold` (empty/absent =
off), edited in the existing "Order rules" widget on Settings → Store next to the minimum
order value; per-zone minimum on `delivery_zone.min_order_value` (nullable). Compared with
`cart.item_total` (gross, after discounts, without shipping), like the minimum order value.

**Rationale**: same pattern and same widget as `catering_min_order_value`; no new table for one
number.

## R-08 — Delivery address on the cart

**Decision**: delivery uses Medusa's own `cart.shipping_address` (first/last name, `address_1`,
`postal_code`, `city`, `phone`, `country_code: "pl"`), copied by Medusa to the order. Pickup
keeps leaving it empty (current contract). `billing_address` stays for invoice data.

**Rationale**: native field, visible in the Admin order page, used by Medusa's refresh of
shipping methods; no metadata duplication.

## R-09 — Admin

**Decision**:

- new Settings page "Strefy dostawy" (`admin/routes/settings/delivery-zones/page.tsx`): list,
  create, edit, delete zones (name, price, optional minimum, postal codes as a pasted
  comma/space/line-separated list, server-side validation naming invalid entries and the zone
  that already has a code), plus a "check a postal code" field;
- the existing schedule settings page gets a method switch (Odbiór / Dostawa) — the Admin API
  is already method-parametrised — plus the "max deliveries per window" field for delivery;
- calendar, order term widget and "Zapytania" page show method, address, phone, zone and cost;
  the confirm dialog asks for the delivery cost when the request is out of zone.

## R-10 — E-mails

**Decision**: `src/lib/emails/data.ts` builds a `fulfillment` block per order/request —
`{ method: "pickup", address: venue }` or `{ method: "delivery", address: shipping_address,
cost }`; templates branch on `method` for wording ("Odbiór" / "Dostawa", "odbierz" / "dowieziemy
pod adres"). Template ids stay the same (`pickup-rescheduled`, `pickup-reminder`), so idempotency
keys and the history widget are unchanged; only subjects/body text differ by method.

**Rationale**: renaming template ids would orphan the history and the retry job's rows; the
method lives in the data, not in the template name.

## R-11 — Setup

**Decision**: `src/scripts/setup-delivery.ts` (called from `seed.ts` after `setupPickup`):
delivery fulfillment set "Dostawa" (type `shipping`) on the same stock location, service zone
"Polska" (country PL), calculated option "Dostawa" with provider id
`catering-delivery_catering-delivery` (`<identifier>_<id>`, like `manual_manual`);
the `delivery` schedule row (max 2 per window, lead time 48 h, windows 10–12, 12–14, 14–16,
16–18 on the pickup weekdays) and the two example zones — each created only if missing, never
overwritten. The "non-pickup option" warning in `setup-pickup.ts` is removed.

*Amended after code review (PR #10)*: `seed.ts` runs on every deploy, so the zones are created
only together with the schedule (deleting them sticks). *Amended 2026-10-29*: the example zones
are replaced by the final ones — rings up to 5 km (30 zł) and 5–10 km (50 zł) around the venue,
from OpenStreetMap (`docs/strefy-dostawy/`, data in `src/scripts/data/delivery-zones.ts`) —
created in every environment, production included, with delivery enabled.

## R-12 — Enum migration

**Decision**: `FULFILLMENT_METHODS = ["pickup", "delivery"]`; `medusa db:generate catering`
emits the check-constraint change for `blocked_date`, `booking`, `fulfillment_schedule`,
`window_rule`, plus the new tables/columns, in one new migration.

## R-13 — Verification in 2.21.1 (task T001)

- (a) `refreshCartShippingMethodsWorkflow` and `addShippingMethodToCartWorkflow` run
  `listShippingOptionsForCartWithPricingWorkflow.runAsStep({ input: { cart_id, options, … } })`,
  so a handler on its `setCalculatedShippingPricingContext` hook prices every add and every
  refresh. A refreshed method keeps only options that are present **and** have a defined
  `calculated_amount` — the provider must always return a number (R-02).
- (b) The hook gets `{ input }` with `input.cart_id`; the provider context is
  `{ ...hookResult, ...cart, items, from_location }` (cart keys win on a name clash, so the
  `catering_delivery_amount` key is safe).
- (c) `defineConfig` registers the fulfillment module with `fulfillment-manual` (id `manual`) by
  default; a custom `fulfillment` entry replaces those options, so it must list `manual` again
  next to `catering-delivery`.
- (d) Adding an option removes the cart's methods of the same shipping profile first (replace).
  For the re-price after a staff confirmation `refreshCartShippingMethodsWorkflow({ cart_id })`
  is enough and simpler than re-adding (used in T027).
