# Implementation Plan: Transactional E-mails

**Branch**: `006-transactional-emails` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-transactional-emails/spec.md`

## Summary

Send the shop's transactional e-mails — order confirmation (the legal confirmation of the
contract), every request state change, staff alerts for new orders/requests and undecided
requests, reschedule/cancel notices and a pickup reminder — through Medusa's Notification
Module with a small Resend provider. Subscribers on `order.placed`, `order.canceled`, the
`catering.request.*` events from 005 and a new `catering.pickup.rescheduled` event, plus three
scheduled jobs (staff reminder, pickup reminder, retry of failed e-mails). Idempotency keys of
the Notification Module make every e-mail go out once; its records give the Admin an e-mail
history. Outside production e-mails reach only an allow-list.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24 LTS

**Primary Dependencies**: Medusa 2.21.1 (Notification Module, subscribers, scheduled jobs,
Admin SDK widgets); new: `resend` 6.34.1 (research R-02)

**Storage**: PostgreSQL — Notification Module's `notification` table (existing core table);
store metadata for two settings; no migration of our own

**Testing**: Jest unit tests (templates, recipient/allow-list rules, reminder selection);
HTTP integration tests (`integration-tests/http/notifications.spec.ts`) against a local
PostgreSQL with a capturing test provider

**Target Platform**: Railway (staging today; production later), Resend API

**Project Type**: web service (Medusa backend + Admin extensions); no storefront change

**Performance Goals**: e-mail within 2 min of the event (SC-001–003); volumes of tens per day

**Constraints**: sending never blocks or rolls back commerce flows (FR-008); once per event
(FR-007); no real customer e-mails from staging (FR-013)

**Scale/Scope**: 12 templates, 5 subscribers, 3 jobs, 1 Admin route, 2 Admin widgets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / rule | Status | Notes |
|---|---|---|
| I. Medusa-native | ✅ | core Notification Module + module provider, subscribers, scheduled jobs, store metadata; no core patch |
| II. Ordering UX | ✅ | guest checkout unchanged; e-mails make the request flow (deadlines) work without the status page |
| III. Brand | ✅ with note | logo and colours from la-palette-garden; inline copies of the token values are required by e-mail clients — see Complexity Tracking |
| IV. Consumer law | ✅ | order confirmation on a durable medium with the contract data and terms link (FR-001); request e-mails say it is not yet an order |
| V. Mobile/a11y | ✅ | single-column HTML from 360 px, plain-text part, real text (no image-only content) |
| VI. Tested critical paths | ✅ | integration tests: every trigger sends once, failures don't break completion, request e-mails per state |
| VII. Simplicity | ✅ | no own tables, no queue, string templates; one new dependency (justified below) |
| VIII. Source of truth + contracts | ✅ | backend owns e-mails; no Store API change; e-mail catalogue and Admin API in [contracts/](contracts/) |
| Version policy | ✅ | `resend` latest 6.34.1; Medusa 2.21.1 vs latest 2.22.1 — same major, no upgrade needed |

**Post-design re-check**: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/006-transactional-emails/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── emails.md        # template catalogue: subjects, contents, rules
│   └── admin-api.md     # e-mail history route, settings in store metadata
└── tasks.md
```

### Source Code (repository root)

```text
apps/backend/
├── medusa-config.ts                         # notification module + resend provider (email channel)
├── src/modules/resend/                      # provider: index.ts, service.ts (allow-list, suppression)
├── src/lib/emails/
│   ├── layout.ts                            # shared HTML/text layout, escaping, brand values
│   ├── format.ts                            # PL dates, windows, deadlines, amounts
│   ├── templates/*.ts                       # 12 templates → { subject, html, text }
│   ├── data.ts                              # loaders: order / request (cart) → template data
│   └── send.ts                              # sendEmail(): key, resource, staff address, logging
├── src/lib/notification-settings.ts         # store metadata: staff address, reminder hours
├── src/subscribers/
│   ├── email-order-placed.ts                # order-confirmation + staff-new-order
│   ├── email-order-canceled.ts
│   ├── email-request-events.ts              # catering.request.* (one handler, five events)
│   └── email-pickup-rescheduled.ts
├── src/workflows/reschedule-order-pickup.ts # + emit catering.pickup.rescheduled
├── src/jobs/
│   ├── remind-staff-requests.ts
│   ├── send-pickup-reminders.ts
│   └── retry-failed-notifications.ts
├── src/api/admin/catering/notifications/route.ts
├── src/admin/widgets/
│   ├── notification-settings.tsx            # Settings → Store: staff address, reminder hours
│   └── order-emails.tsx                     # order page: e-mail history
├── src/admin/routes/pickup-requests/page.tsx # + per-request e-mail status
└── integration-tests/http/notifications.spec.ts
```

**Structure Decision**: backend only (Medusa app in `apps/backend`); la-palette-garden is not
changed — e-mails link to its existing pages.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New dependency `resend` | the chosen sending service (Clarifications); official SDK returns message ids for the history | raw `fetch` to the Resend API — saves one small dependency but re-implements its types and errors; SMTP via nodemailer is also a dependency and returns no id |
| Brand colours copied as inline values in `src/lib/emails/layout.ts` (constitution III forbids parallel token sets) | e-mail clients ignore external CSS and custom properties; inline styles are the only portable option | importing la-palette-garden's `globals.css` — another repository, and unusable by e-mail clients anyway; the copy is 4 values with a comment pointing to the source |
| Three scheduled jobs | reminders and retries are time-based (FR-004, FR-006, FR-008) | a single combined job — mixes schedules (15 min vs hourly) and failure handling; Medusa jobs are one file each |
