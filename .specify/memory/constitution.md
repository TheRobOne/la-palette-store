# La Palette Store Constitution

## Core Principles

### I. Medusa-Native Commerce

- The backend MUST be built on the latest stable release of Medusa (v2 line) available when a
  feature's plan is written; the exact version MUST be pinned in `package.json` and lockfile.
- Custom business logic (e.g. per-guest portions, delivery slots, lead-time rules) MUST be
  implemented through Medusa extension points: custom modules, workflows, subscribers,
  API routes, links, and Admin widgets/routes. Forking or patching Medusa core is prohibited.
- Standard commerce concerns (products, pricing, carts, orders, customers, payments,
  fulfillment, regions, taxes) MUST use Medusa's built-in modules before any custom code is
  written; a custom replacement requires a written justification in the feature plan.
- Medusa major/minor upgrades MUST follow the official upgrade guide and be done in a dedicated
  change, never bundled with feature work.

Rationale: staying on Medusa's supported extension surface keeps the store upgradeable and
avoids maintaining a private fork of the commerce engine.

### II. Event-Catering Ordering UX (Megusta-inspired)

The shopping experience MUST follow the UX patterns of https://megustacatering.pl/, adapted
to our catalog:

- Customers MUST be able to browse by category/occasion (e.g. finger food, sets/boxes,
  hot dishes, desserts, drinks) and see price, portion size and minimum order quantity on
  product cards without opening the product page.
- Products MUST support catering-specific quantities: minimum order quantity, quantity steps,
  and sets priced per piece, per portion or per person, clearly labelled.
- Checkout MUST collect the event delivery date and time slot; the storefront and backend MUST
  both enforce the minimum order lead time, blocked dates and daily capacity limits.
- A minimum order value and delivery zones/costs MUST be validated before payment and
  communicated to the customer in the cart, not only at the final step.
- The path from landing page to placed order MUST remain short: product → cart → checkout
  (contact, delivery, date/slot, payment) → confirmation, with guest checkout allowed.

Rationale: event catering is ordered by date and headcount, not by single items; the UX must
prevent orders that the kitchen cannot fulfil.

### III. La Palette Garden Brand Fidelity

- Visual design (colour palette, typography, imagery style, spacing, tone of voice) MUST be
  derived from https://www.lapalettegarden.pl/, whose source lives in the company-owned repo
  `/Users/maciejrusek/git/la-palette-garden` (theme in `src/app/globals.css`, assets in
  `public/`). It MUST be captured as design tokens in a single shared theme source;
  hard-coded colours, fonts or spacing values in components are prohibited.
- UI components MUST be built from a shared component library consuming those tokens so that a
  brand change is a token change, not a component rewrite.
- La Palette Garden is our own company: its logos, photos and brand assets MAY be reused
  directly and SHOULD be taken from the brand repo rather than scraped from the live site.
- Food photography MUST be high quality and served through optimised, responsive images;
  placeholder or stock-looking imagery MUST NOT ship to production.
- https://megustacatering.pl/ is a UX reference only; its logos, photos and copy MUST NOT be
  copied.

Rationale: the store is a sales channel for the La Palette Garden brand and must feel like the
same place; reusing our own assets keeps it consistent while third-party content stays out.

### IV. Food & Consumer-Law Transparency

- Every food product MUST display ingredients and the 14 EU allergens (Regulation (EU)
  No 1169/2011), plus dietary labels (vegetarian, vegan, gluten-free, etc.) where applicable.
- Prices MUST be shown in PLN as gross amounts (VAT included), with delivery costs disclosed
  before the order is placed.
- The store MUST comply with Polish consumer law and GDPR (RODO): terms of service, privacy
  policy, cookie consent, explicit order-with-payment-obligation button, and clear
  cancellation rules for perishable, date-bound goods.
- Customer personal data MUST be collected only as needed for fulfilment and stored only in
  Medusa or explicitly approved processors.

Rationale: selling food online carries legal disclosure obligations; allergen errors are a
health risk, not just a bug.

### V. Mobile-First Performance & Accessibility

- The storefront MUST be designed mobile-first and be fully usable from 360 px width upward.
- Production pages MUST meet Core Web Vitals "good" thresholds (LCP ≤ 2.5 s, INP ≤ 200 ms,
  CLS ≤ 0.1) on a mid-range mobile device profile.
- The storefront MUST meet WCAG 2.2 level AA (contrast, keyboard navigation, focus states,
  labelled form fields, alt text for product images).
- Product and category pages MUST be server-rendered with SEO metadata and structured data
  (schema.org Product/Offer).
- The primary language is Polish; all customer-facing text MUST be externalised to allow
  future translations.

Rationale: most catering orders are browsed on phones; slow or inaccessible pages lose orders.

### VI. Tested Critical Commerce Paths

- Automated tests MUST cover: price and total calculation, minimum quantity/order value rules,
  lead-time and delivery-slot validation, and the full checkout-to-order flow.
- Custom Medusa modules and workflows MUST have integration tests using Medusa's testing
  tooling; the checkout flow MUST have an end-to-end test against a seeded environment.
- A change touching a critical path MUST NOT be merged with failing or skipped tests.

Rationale: a broken checkout or wrong delivery date directly costs money and customer trust.

## Technology Stack & Constraints

- **Backend**: Medusa (latest stable v2), Node.js LTS, TypeScript in strict mode, PostgreSQL,
  Redis for events/cache/workflows in non-development environments.
- **Storefront**: Next.js (App Router) based on the official Medusa Next.js storefront,
  consuming the Medusa Store API via the official JS SDK.
- **Admin**: Medusa Admin, extended with widgets/routes for catering operations (delivery
  calendar, capacity, allergen data) rather than a separate admin app.
- **Payments**: the primary payment provider is Przelewy24 (BLIK, fast bank transfers, cards),
  integrated as a Medusa payment provider module with webhook-based payment confirmation.
  Another Polish payment intermediary MAY be added or substituted only through the same
  payment provider interface, without changes to checkout business logic.
- **Currency/Region**: a Poland region with PLN and Polish VAT rates configured in Medusa.
- **Secrets**: credentials MUST come from environment variables; secrets MUST NOT be committed.
- New runtime dependencies MUST be justified in the feature plan; prefer Medusa-ecosystem or
  well-maintained packages.
- **Latest major versions (ALWAYS)**: every framework, library and tool (Medusa, Next.js,
  React, TypeScript, Node.js LTS, Tailwind, test tooling, etc.) MUST be used in its latest
  stable major version. This applies both when a dependency is first added and on an ongoing
  basis:
  - Each feature plan MUST verify current latest majors against the registry, not rely on
    memory, older repos or examples.
  - When a new stable major is released, an upgrade MUST be planned as a dedicated change and
    completed before new feature work builds on the outdated major.
  - Staying on an older major is allowed only when the latest major is incompatible with Medusa
    or another required dependency; the blocker MUST be documented in the plan's Complexity
    Tracking and revisited at the next upgrade review.
  - Pre-release versions (alpha, beta, RC, canary) MUST NOT be used in production.
  - Exact versions remain pinned via the lockfile for reproducible builds.

## Development Workflow & Quality Gates

- Every feature follows the Spec Kit flow: specify → (clarify) → plan → tasks → implement.
  Each plan MUST include a Constitution Check against the principles above.
- All code MUST pass linting, type checking (`tsc --noEmit`) and the test suite in CI before
  merge.
- UI changes MUST be reviewed against the design tokens and the reference UX flow; reviewers
  verify there are no hard-coded brand values.
- Database schema changes MUST ship as Medusa migrations and be reversible or accompanied by a
  documented rollback plan.
- Changes are merged via pull request with at least one review.

## Governance

- This constitution supersedes other project practices and conventions. Where a spec, plan or
  task conflicts with it, the constitution wins until it is amended.
- Amendments are made via `/speckit-constitution`, recorded in a pull request with a rationale,
  and MUST update the version below.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle, MINOR
  for adding a principle/section or materially expanding guidance, PATCH for clarifications
  and wording.
- Every plan's Constitution Check and every code review MUST verify compliance; any deviation
  MUST be listed in the plan's Complexity Tracking with justification and a simpler
  alternative that was rejected.
- Compliance is reviewed at each Medusa upgrade and at least once per quarter.

**Version**: 1.1.0 | **Ratified**: 2026-09-28 | **Last Amended**: 2026-09-28
