# Feature Specification: Project Skeleton

**Feature Branch**: `001-project-skeleton`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Zbudujmy szkielet projektu" (Let's build the project skeleton)

## Clarifications

### Session 2026-09-28

- Q: Should the skeleton include deploying the store to a hosted environment, or only local
  development and automated checks? → A: Local + CI + automatic deployment of a hosted
  staging environment on every change merged to `main`; production is out of scope.
- Q: Should seeded sample products be fictional or real items from the La Palette Garden
  sample menu? → A: Fictional products with placeholder names and placeholder images.
- Q: Who should be able to access the staging store — anyone with the address, or only
  people with a password? → A: Public at its address, no password; only search-engine
  indexing is blocked.
- Q: Which admin credentials should the seed create on the public staging environment? →
  A: Locally, fixed credentials documented in the README; on staging, the admin password
  comes from environment secrets and is never stored in the repository.
- Spec update (stakeholder directive, supersedes an earlier Supabase decision): the
  database is hosted on Railway in all environments, including local development; Docker
  is not used on developer machines. This is a very small shop — local development and CI
  must be as simple as possible.
- Q: Which database should local development use? → A: One shared **dev** database on
  Railway, separate from staging (the team is a single developer).
- Q: Is a cache/queue service (Redis) needed? → A: No, not in this feature — neither
  locally nor on staging; revisit before production.
- Q: Which database should automated checks (CI) use? → A: None — CI runs only lint, type
  check, unit tests and build; database-dependent tests run locally against dev.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer runs the whole store locally (Priority: P1)

A developer clones the repository, follows a short setup guide, and with a single start
command gets the commerce backend, the store administration panel and the customer-facing
storefront running on their machine, connected to each other and filled with sample data.

**Why this priority**: Every later feature (catalog, checkout, delivery slots, payments)
is built and tested on top of this. Without a working local environment no other work can
start.

**Independent Test**: On a clean machine with only the documented prerequisites installed,
follow the README; the storefront home page, the admin login page and a backend health
check all respond, and the storefront shows sample products served by the backend.

**Acceptance Scenarios**:

1. **Given** a fresh clone and documented prerequisites, **When** the developer runs the
   documented setup and start commands, **Then** backend, admin panel and storefront start
   without errors and are reachable at documented local addresses.
2. **Given** the environment is running, **When** the developer opens the storefront,
   **Then** it lists sample products fetched live from the backend (not hard-coded).
3. **Given** the environment is running, **When** the developer runs the documented seed
   command a second time, **Then** it completes without duplicating data or failing.
4. **Given** a required configuration value is missing, **When** the developer starts the
   environment, **Then** startup stops with a message naming the missing value.

---

### User Story 2 - Store operator logs into the admin panel (Priority: P1)

A La Palette Garden staff member opens the administration panel, logs in with a seeded
admin account, and sees the store configured for the Polish market: a Poland region,
PLN currency, Polish VAT, and the sample catalog.

**Why this priority**: Confirms the commerce foundation is configured correctly for the
business (region, currency, taxes) before any catering-specific features are added.

**Independent Test**: Log in with the documented seeded credentials; verify region,
currency, tax rate and sample products are visible and editable.

**Acceptance Scenarios**:

1. **Given** the seeded admin account, **When** the operator logs in, **Then** the admin
   dashboard opens.
2. **Given** the staging environment, **When** someone tries the local credentials from
   the README, **Then** login fails; only the password set in staging secrets works.
3. **Given** the operator is logged in, **When** they open store settings, **Then** a
   "Poland" region with PLN currency and Polish VAT rates exists and is the default.
4. **Given** the operator edits a sample product's price, **When** they reload the
   storefront, **Then** the new price is displayed (gross, in PLN).

---

### User Story 3 - Customer sees a branded storefront shell (Priority: P2)

A visitor opens the storefront and sees a page that already looks like La Palette Garden:
logo, brand colours and fonts, header with navigation placeholders, footer with company
contact details, and legal links (terms, privacy policy) — in Polish, usable on a phone.

**Why this priority**: Establishes the shared visual foundation (design tokens, layout,
brand assets) that every future screen reuses, but the store can be developed without it
for a short time.

**Independent Test**: Open the storefront on a 360 px wide viewport and on desktop;
verify logo, brand palette and typography match lapalettegarden.pl, and that text is
Polish.

**Acceptance Scenarios**:

1. **Given** the storefront home page, **When** viewed on a phone-sized screen, **Then**
   the layout fits without horizontal scrolling and the navigation is usable.
2. **Given** the storefront, **When** compared with lapalettegarden.pl, **Then** the logo,
   colour palette and typography match the brand.
3. **Given** any storefront page, **When** a brand colour is changed in the single theme
   source, **Then** the change appears across all pages without editing individual
   components.
4. **Given** the footer, **When** the visitor clicks "Regulamin" or "Polityka prywatności",
   **Then** a placeholder page opens (final legal text is out of scope).

---

### User Story 4 - Every change is verified and deployed to staging (Priority: P2)

When a developer proposes a change, a minimal set of automated checks (lint, type check,
unit tests, build) runs and blocks merging if anything fails. Once a change lands on `main`, a hosted
staging environment is updated automatically so stakeholders can review progress online.

**Why this priority**: The constitution requires quality gates before merge; setting them
up in the skeleton prevents drift from day one.

**Independent Test**: Open a change that introduces a deliberate type error; the checks
fail. Revert it; the checks pass.

**Acceptance Scenarios**:

1. **Given** a proposed change, **When** it is submitted, **Then** lint, type check, unit
   tests and build run automatically, without any database or external service.
2. **Given** any check fails, **When** a merge is attempted, **Then** the result is
   reported as failed with a readable reason.
3. **Given** the dependency manifest, **When** it is reviewed, **Then** every framework
   and library is on its latest stable major version (or has a documented exception).
4. **Given** a change is merged to `main` and all checks pass, **When** the pipeline
   finishes, **Then** the staging environment is automatically updated and the storefront,
   admin panel and backend health check respond at their staging addresses.
5. **Given** a change fails checks, **When** it is merged or pushed, **Then** staging is not
   updated and keeps running the last good version.

---

### Edge Cases

- The backend is not running when the storefront starts: the storefront shows a friendly
  "store temporarily unavailable" message instead of crashing.
- Ports used by default are already taken: the documentation explains how to change them
  through configuration.
- The seed runs against a database that already contains data: it is idempotent and does
  not create duplicates.
- The developer has no internet connection or the hosted dev database is unreachable:
  startup fails within 30 seconds with a message saying the database cannot be reached,
  instead of hanging.
- A developer uses an unsupported runtime version: setup fails early with a clear message
  stating the required version.
- Secrets or local configuration files are accidentally staged: they are excluded from the
  repository by default ignore rules; only an example configuration file is committed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST contain three runnable parts — commerce backend, admin
  panel, and customer storefront — organised in one repository with a shared set of
  development commands.
- **FR-002**: The whole environment MUST start locally with a single documented command
  after a one-time setup, without requiring a container runtime (Docker or similar) on the
  developer's machine.
- **FR-002a**: The store's database MUST be hosted on Railway in every environment,
  including local development: local apps connect over the network to a hosted database
  instead of one running on the developer's machine. There MUST be exactly two databases:
  **dev** (used by local development) and **staging** (used only by the staging
  environment); local work MUST never connect to staging.
- **FR-002b**: No cache/queue service is used in this feature, locally or on staging; the
  backend runs with its built-in in-process equivalents. Adding one is deferred to the
  production-readiness feature.
- **FR-002c**: Local development MUST stay minimal: after cloning, at most three commands
  (install, one-time setup, start) get the store running, and no software beyond the
  language runtime and package manager has to be installed.
- **FR-003**: The store MUST be preconfigured with a Poland region, PLN currency, Polish
  VAT rates and Polish as the storefront language.
- **FR-004**: A repeatable, idempotent seed MUST create an admin account, the Poland
  region, a sales channel for the storefront, and at least 6 sample catering products in at
  least 2 categories, each with gross price in PLN, minimum order quantity, ingredients and
  allergen information. All sample products MUST be fictional (placeholder names,
  descriptions and generic placeholder images), clearly recognisable as test data, and
  MUST NOT reuse items from the real La Palette Garden menu.
- **FR-004a**: The seeded admin account MUST use fixed credentials documented in the README
  only in local development. On staging the admin email and password MUST be provided
  through environment secrets; the seed MUST refuse to create a staging admin when they
  are missing, and the documented local credentials MUST NOT work on staging.
- **FR-005**: The storefront MUST display products retrieved from the backend on a home
  or listing page, showing name, image, gross price in PLN.
- **FR-006**: The storefront MUST include a shared layout (header with logo and
  navigation placeholders, footer with company details and legal links) styled from a
  single brand theme source derived from La Palette Garden.
- **FR-007**: Brand assets for the storefront shell (logo, hero/decorative photos) MUST be
  taken from the company's La Palette Garden repository; product images stay placeholders
  (see FR-004).
- **FR-008**: All customer-facing text MUST come from a Polish text resource, not be
  embedded directly in components.
- **FR-009**: Configuration and secrets MUST be supplied through environment settings; an
  example configuration file listing every required value MUST be committed, and real
  values MUST NOT be.
- **FR-010**: The backend MUST expose a health check that reports whether it and its
  database are available.
- **FR-011**: Automated checks MUST stay minimal and MUST NOT need a database or any
  external service: on every proposed change they run lint, type check, unit tests and a
  production build of every part, and report pass/fail. Checks that need a database
  (backend integration tests, end-to-end smoke test) run on demand locally against the
  **dev** database, never against staging.
- **FR-011a**: Every change merged to `main` that passes all checks MUST be deployed
  automatically to a hosted staging environment (backend, admin panel, storefront, with
  their own staging database, seeded with sample data). Failed checks MUST block the
  deployment. The staging storefront MUST be reachable by anyone with its address without a
  password (the admin panel keeps its normal staff login), MUST instruct search engines not
  to index any page, and MUST NOT process real payments or real customer data.
- **FR-012**: All frameworks and libraries MUST be on their latest stable major versions
  at the time of implementation, with exact versions locked.
- **FR-013**: The repository MUST include a README describing prerequisites, setup,
  start, seed, test commands and local addresses of each part.
- **FR-014**: Placeholders MUST exist for the future extension areas named in the
  constitution (custom catering logic modules, payment provider integration, admin
  extensions) so later features have an agreed place to live, without implementing them.

### Key Entities

- **Region**: Market configuration — Poland, PLN currency, VAT rates, default for the
  storefront.
- **Sales Channel**: The web storefront as the channel through which products are sold.
- **Product (sample)**: Fictional catering item with name, description, placeholder image,
  gross price, category, minimum order quantity, ingredients and allergens.
- **Category**: Grouping of products (e.g. finger food, desserts).
- **Admin User**: Staff account able to log into the administration panel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer new to the project gets all three parts running locally in under
  30 minutes by following only the README.
- **SC-002**: After initial setup, starting the full environment takes under 2 minutes.
- **SC-003**: Automated checks on a proposed change finish in under 5 minutes.
- **SC-003a**: A change merged to `main` is live on staging within 15 minutes, without any
  manual step.
- **SC-004**: The storefront home page scores "good" on all Core Web Vitals and has no
  WCAG 2.2 AA violations flagged by an automated accessibility audit.
- **SC-005**: 100% of sample products visible in the admin panel appear on the storefront
  with matching prices.
- **SC-006**: A brand stakeholder confirms the storefront shell is recognisably La Palette
  Garden (logo, colours, fonts) on first review.

## Assumptions

- Scope is local development, automated checks and an automatically deployed staging
  environment; production deployment and a custom domain are a separate feature.
- Catalog browsing, cart, checkout, delivery date/slot selection, Przelewy24 payments and
  final legal texts are out of scope — only placeholders or extension points are created.
- Sample product data is fictional; the real menu (names, prices, allergens, photos) will
  be entered in a later feature.
- Developers work on macOS or Linux with a stable internet connection; no container
  runtime is installed or required locally. Offline development is not supported because
  the database is always hosted on Railway.
- The team is one developer, so a shared dev database does not cause conflicts.
- The shop is very small (low traffic, one staging instance), so in-process event and job
  handling is sufficient until production.
- The CI service is the one attached to the project's code host (GitHub is assumed, once
  the remote repository exists); staging deployment depends on that remote repository
  and on an account with the chosen hosting provider.
- Technical decisions for this and later features are based only on the public Medusa
  documentation (docs.medusajs.com); paid Medusa services (e.g. the documentation MCP
  server) are not used.
- Brand theme values are read from `src/app/globals.css` and assets from `public/` in the
  La Palette Garden repository.
