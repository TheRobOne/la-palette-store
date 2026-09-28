# Feature Specification: Remove Locale/Country Code from Storefront URLs

**Feature Branch**: `002-remove-locale-prefix`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "nie podoba mi sie ze w path jest pl. Sklep bedzie tylko po
polsku, nie potrzebujemy tego." (Dislikes the `pl` in the URL path; the store will only
ever be in Polish, so it isn't needed.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visitor browses the shop with clean, locale-free URLs (Priority: P1)

A visitor opens the store's domain and every page — home, product listing, a single
product, legal pages — is reachable at a plain, readable address, with no `/pl` or other
locale/country segment at the front of the path. Sharing a link, bookmarking a page, or
typing the domain from memory all lead directly to the right page.

**Why this priority**: The URL prefix is user- and stakeholder-visible on every single
page; it's the most immediate, most visible piece of the "this is a one-market, Polish-only
shop" decision, and every other page in the store depends on the URL structure this story
fixes.

**Independent Test**: Open the store's root domain and a product page; confirm neither the
address bar nor any on-page link contains a locale/country segment, and that the root
domain loads the home page directly without an extra redirect hop.

**Acceptance Scenarios**:

1. **Given** the store's root domain, **When** a visitor opens it, **Then** the home page
   loads directly, with no redirect to a locale- or country-prefixed address.
2. **Given** any storefront page (home, a category, a product, a legal page), **When** a
   visitor looks at the address bar, **Then** the path contains no locale or country code
   segment.
3. **Given** any link within the storefront (navigation, footer, a product card), **When**
   a visitor follows it, **Then** the destination address also has no locale/country
   segment.
4. **Given** a visitor pastes or types a storefront address without any locale/country
   segment, **When** the page loads, **Then** it resolves directly to the intended page
   (not a 404 and not a redirect that adds a segment).

---

### Edge Cases

- A visitor requests a page structurally identical to an old locale-prefixed address (e.g.
  from a screenshot or note taken during development): the request MUST NOT be required to
  include a locale/country segment to succeed; whether an old-style address also still
  works is not required, since the store has not yet been publicly launched and no such
  links exist in the wild (see Assumptions).
- Search engines or social previews crawling the store: sitemap, canonical URLs and
  robots directives MUST all use the locale-free address form, so nothing points crawlers
  or link previews at a locale-prefixed address.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every storefront page MUST be reachable at an address with no locale or
  country code path segment.
- **FR-002**: The storefront MUST keep operating against a single, fixed Poland/PLN market
  configuration without the visitor or the URL ever needing to state it.
- **FR-003**: Every link generated within the storefront (navigation, footer, product
  cards, and any other internal link) MUST point to a locale-free address.
- **FR-004**: The root address of the store MUST render the home page directly, without an
  intermediate redirect to add a locale/country segment.
- **FR-005**: Search-engine-facing metadata that names storefront addresses (canonical
  URLs, sitemap entries, `robots.txt` allow/disallow rules) MUST use the locale-free
  address form.
- **FR-006**: The change MUST NOT alter what any page shows or how it behaves — only the
  address it lives at.

### Key Entities

- Not applicable — this feature changes address structure and internal linking only; no
  new or modified data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of storefront pages (home, category, product, legal) are reachable at
  a locale-free address.
- **SC-002**: The store's root domain reaches the home page in a single request, with zero
  redirect hops added for locale/country purposes.
- **SC-003**: A manual scan of on-page links across the home, a category, and a product
  page finds zero links containing a locale or country code segment.
- **SC-004**: Every automated check that already exists for the storefront (lint, type
  check, unit tests, build, the accessibility-audited smoke test) continues to pass
  unchanged after this feature, confirming no visible behaviour regressed.

## Assumptions

- The store has not been publicly launched (staging is not yet deployed — see feature
  001-project-skeleton); no real inbound links, bookmarks or search-engine listings using
  the old locale-prefixed addresses exist. Preserving old addresses via redirects is
  therefore out of scope; if the store is later found to have live locale-prefixed links
  after all, adding redirects is a small follow-up.
- The store serves a single market (Poland, Polish language, PLN currency) for the
  foreseeable future; this feature does not need to preserve any path for adding another
  market or language later — that would be a new feature if it's ever needed.
- "Locale/country segment" means any URL path segment whose sole purpose is to select a
  market or language (e.g. the current `pl`); it does not include meaningful path words
  that happen to be Polish, such as `regulamin`.
