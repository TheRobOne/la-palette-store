<!--
Sync Impact Report
==================
Version change: 2.0.0 → 2.1.0
Bump rationale: MINOR — architectural decision of 2026-10-04 moves the storefront out of this
repository. No principle is removed; storefront obligations are re-homed to la-palette-garden,
and new binding rules are added (backend as source of truth for order rules, Store API
contracts, SDK version alignment). Requested explicitly as a MINOR amendment.

Modified principles:
- II. Event-Catering Ordering UX — now binding on the la-palette-garden storefront; backend
  MUST enforce lead time/blocked dates/capacity, storefront MAY validate for UX only.
- III. La Palette Garden Brand Fidelity — shop UI uses la-palette-garden's own theme tokens
  directly (no copied token source in this repo).
- V. Mobile-First Performance & Accessibility — applies to the storefront in
  la-palette-garden (`/catering`).
- VI. Tested Critical Commerce Paths — checkout-to-order E2E in this repo runs through the
  Store API (HTTP integration tests); browser-level E2E belongs to la-palette-garden.

Added principles:
- VIII. Backend as Source of Truth & Store API Contracts

Modified sections:
- Technology Stack & Constraints — "Storefront: Next.js based on the official Medusa Next.js
  storefront" replaced by "Repository scope" + "Store API client" (la-palette-garden,
  src/catering, @medusajs/js-sdk server-side only, publishable key); Infrastructure & Hosting
  names api.lapalettegarden.pl and Vercel as frontend hosting; new "Client SDK version
  alignment" rule.
- Development Workflow & Quality Gates — Store API changes require contracts/; Medusa upgrades
  require a coordinated upgrade in la-palette-garden.
- Governance — UX/brand/legal principles are referenced by la-palette-garden's AGENTS.md.

Added sections: none (new principle VIII only)
Removed sections: none

Follow-up TODOs: none.

Documents requiring updates (not changed by this amendment):
- ⚠ AGENTS.md — still the generic Medusa DTC starter text: "optional storefront",
  storefront:dev/lint commands, building-storefronts skill, NEXT_PUBLIC_* publishable-key
  mistake; MCP server recommendation conflicts with Knowledge Sources. Rewrite as backend-only
  and point to la-palette-garden as the Store API client.
- ⚠ README.md — intro ("Medusa Next.js Starter Storefront"), localhost:8000, publishable key
  copied into apps/storefront/.env.local, `pnpm dev` / lint / build / test:e2e "both apps",
  Project layout listing apps/storefront.
- ⚠ .github/workflows/ci.yml — NEXT_PUBLIC_* placeholder env vars and STORE_CORS/AUTH_CORS
  :8000 origins only exist for the storefront; drop once apps/storefront is removed.
- ⚠ package.json — `test:e2e` filters storefront; root react/react-dom devDependencies and
  pnpm-workspace.yaml @types/react overrides exist for the storefront.
- ⚠ apps/storefront/ — to be removed (throwaway) in a dedicated change.
- ⚠ apps/backend medusa-config / Railway variables — STORE_CORS, MEDUSA_BACKEND_URL for
  api.lapalettegarden.pl.
- ⚠ la-palette-garden: add AGENTS.md referencing this constitution (Principles II–V, VIII)
  and pin @medusajs/js-sdk + @medusajs/types to 2.21.1.
- ✅ .specify/templates/* — no storefront references; Constitution Check reads principles at
  runtime.
- Note: specs/001-project-skeleton and specs/002-remove-locale-prefix describe the in-repo
  storefront; they are historical and are not rewritten.
-->

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
to our catalog. This principle binds the storefront in la-palette-garden (`/catering`) as a
business requirement, even though its code lives outside this repository:

- Customers MUST be able to browse by category/occasion (e.g. finger food, sets/boxes,
  hot dishes, desserts, drinks) and see price, portion size and minimum order quantity on
  product cards without opening the product page.
- Products MUST support catering-specific quantities: minimum order quantity, quantity steps,
  and sets priced per piece, per portion or per person, clearly labelled.
- Checkout MUST collect the event delivery date and time slot; the backend MUST enforce the
  minimum order lead time, blocked dates and daily capacity limits (Principle VIII), and the
  storefront MAY repeat these checks to give early feedback.
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
  `public/`). The shop UI (`src/catering` in la-palette-garden) MUST consume that site's
  existing design tokens as the single theme source; a copied or parallel token set is
  prohibited, as are hard-coded colours, fonts or spacing values in components.
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

- These rules bind the storefront in la-palette-garden (`lapalettegarden.pl/catering`).
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
  tooling; the checkout-to-order flow MUST have an end-to-end test through the Store API
  (HTTP integration tests) against a seeded database, including rejection of orders that
  break the order rules of Principle VIII. Browser-level end-to-end tests of the storefront
  belong to la-palette-garden.
- A change touching a critical path MUST NOT be merged with failing or skipped tests.
- Integration and end-to-end tests MAY run locally against the dev database instead of in CI
  (see Development Workflow); they MUST be run and pass before merging any change that
  touches a critical path, and the result MUST be noted in the change description.

Rationale: a broken checkout or wrong delivery date directly costs money and customer trust.

### VII. Simplicity First

- This is a very small shop developed and operated by one person. Every spec and plan MUST
  choose the simplest solution that meets the requirements.
- Every additional service, tool, dependency or infrastructure layer (queues, caches,
  containers, extra environments, extra CI jobs, abstractions) MUST be justified in the
  plan's Complexity Tracking with the simpler alternative that was rejected.
- Features MUST NOT be built for hypothetical future scale; capacity is added when a
  measured need appears (e.g. Redis at production launch).

Rationale: one developer's time is the scarcest resource; every moving part must pay for
itself.

### VIII. Backend as Source of Truth & Store API Contracts

- The backend is the single source of truth for order rules: delivery zones and costs,
  minimum order value, lead time, blocked dates, daily capacity limits, and catering
  quantities (minimum quantity, quantity steps). The backend MUST reject an order that
  violates any of them regardless of what the storefront sent or validated.
- The storefront MAY validate the same rules for UX, but MUST NOT be the only place a rule is
  enforced, and MUST NOT hard-code rule values the backend can provide.
- Every feature that adds or changes Store API behaviour (routes, request/response shapes,
  error codes, cart/order metadata) MUST describe it in its `specs/<feature>/contracts/`
  documents. These contracts are the only API documentation for la-palette-garden, which does
  not use Spec Kit, and MUST be written so they can be implemented without reading backend
  code.
- Breaking Store API changes MUST be flagged as breaking in the contract and coordinated with a
  matching change in la-palette-garden before deployment.

Rationale: the storefront lives in another repository with its own release cycle; only the
backend can guarantee the kitchen never receives an order it cannot fulfil, and only written
contracts keep two repositories in sync.

## Technology Stack & Constraints

- **Backend**: Medusa (latest stable v2), Node.js LTS, TypeScript in strict mode, PostgreSQL.
  Redis (event bus, workflow engine, locking, cache) is REQUIRED only in production; local
  development and staging use Medusa's built-in in-memory modules.
- **Repository scope**: this repository is the Medusa backend only (Store API + Admin). It
  MUST NOT contain a customer-facing storefront.
- **Store API client**: the storefront is built in the la-palette-garden repository (company
  website, Next.js) under `lapalettegarden.pl/catering`, in a dedicated `src/catering`
  module. It MUST call the Store API with `@medusajs/js-sdk` only on the server (Server
  Components / Server Actions), authenticated with a publishable API key.
- **Client SDK version alignment**: the `@medusajs/js-sdk` and `@medusajs/types` versions in
  la-palette-garden MUST match the Medusa version pinned in this repository; a Medusa upgrade
  here requires a coordinated upgrade in la-palette-garden.
- **Infrastructure & Hosting**: the backend, PostgreSQL and (in production) Redis are hosted on
  Railway; the production backend is served at `api.lapalettegarden.pl`. PostgreSQL is hosted
  on Railway in every environment, including local development. Dev and staging MUST use
  separate databases, and local development MUST never connect to the staging (or
  production) database. Docker MUST NOT be required on the developer's machine. The frontend
  (la-palette-garden, `lapalettegarden.pl`) is hosted on Vercel on a plan that permits
  commercial use (the Hobby plan does not).
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
- **Knowledge sources**: technical decisions about Medusa MUST be based on the public
  documentation at docs.medusajs.com and the npm registry. Paid Medusa services (e.g. the
  documentation MCP server) are not used.

## Development Workflow & Quality Gates

- Every feature follows the Spec Kit flow: specify → (clarify) → plan → tasks → implement.
  Each plan MUST include a Constitution Check against the principles above.
- CI MUST stay minimal and MUST NOT require a database or any external service: it runs
  linting, type checking (`tsc --noEmit`), unit tests and production builds, and all of them
  MUST pass before merge.
- Integration tests (Medusa test utilities) and end-to-end tests run locally against the dev
  database and MUST pass before merging changes that touch critical paths (Principle VI).
- UI changes MUST be checked against the design tokens and the reference UX flow; the
  self-review verifies there are no hard-coded brand values.
- A feature changing the Store API MUST include its contract in `specs/<feature>/contracts/`
  (Principle VIII) before implementation starts.
- A Medusa upgrade MUST be accompanied by a coordinated upgrade of `@medusajs/js-sdk` and
  `@medusajs/types` in la-palette-garden.
- Database schema changes MUST ship as Medusa migrations and be reversible or accompanied by a
  documented rollback plan.
- Changes are merged via pull request after a self-review by the developer using a
  constitution compliance checklist (Principles I–VIII, stack and workflow rules). An
  automated code review MAY be used in addition; it does not replace the self-review.

## Governance

- This constitution supersedes other project practices and conventions. Where a spec, plan or
  task conflicts with it, the constitution wins until it is amended.
- Amendments are made via `/speckit-constitution`, recorded in a pull request with a rationale,
  and MUST update the version below.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle, MINOR
  for adding a principle/section or materially expanding guidance, PATCH for clarifications
  and wording.
- Every plan's Constitution Check and every self-review MUST verify compliance; any deviation
  MUST be listed in the plan's Complexity Tracking with justification and a simpler
  alternative that was rejected.
- Principles II–V and VIII also bind la-palette-garden's shop module; that repository's
  AGENTS.md MUST reference this constitution rather than restate it.
- Compliance is reviewed at each Medusa upgrade and at least once per quarter.

**Version**: 2.1.0 | **Ratified**: 2026-09-28 | **Last Amended**: 2026-10-04
