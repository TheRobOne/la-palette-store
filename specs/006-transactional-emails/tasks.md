---

description: "Task list for 006-transactional-emails"
---

# Tasks: Transactional E-mails

**Input**: Design documents from `/specs/006-transactional-emails/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/emails.md](contracts/emails.md),
[contracts/admin-api.md](contracts/admin-api.md), [quickstart.md](quickstart.md)

**Tests**: required — constitution Principle VI (order confirmation is part of the
checkout-to-order flow; request e-mails per state), FR-007 (once) and FR-008 (failures don't
break flows).

**Organization**: by user story; paths relative to the repo root, backend in `apps/backend/`.
Integration tests run against a local PostgreSQL (README "Integration tests") and use a
capturing test provider instead of Resend.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1–US5 from spec.md

---

## Phase 1: Setup

- [X] T001 Verify in Medusa 2.21.1 and record in [research.md](research.md): (a) a resend through `createNotifications` with the idempotency key of a `failure` notification updates that row to `success` — or confirm the R-06 fallback (new id, row stays `failure`) and decide; (b) the Notification Module is loaded by default and accepts `providers` options in `medusa-config.ts` (`resolve: "@medusajs/medusa/notification"`); (c) converting a draft order emits `order.placed`; (d) `order.canceled` payload carries the order id
- [X] T002 Add `resend@6.34.1` to `apps/backend/package.json` (pnpm, root lockfile); add `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `STOREFRONT_URL`, `NOTIFICATION_ALLOWLIST` to `apps/backend/.env.template` with comments (data-model "Environment variables")

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 Resend provider module `apps/backend/src/modules/resend/service.ts` + `index.ts` (`ModuleProvider(Modules.NOTIFICATION, { services: [ResendNotificationService] })`): extends `AbstractNotificationProviderService`, `identifier = "resend"`, options `{ api_key?, from, reply_to?, app_env, allowlist }`; `send()` renders `notification.template` with `notification.data` (T006), suppresses per research R-03 (log + `{ id: "suppressed" }`), else `resend.emails.send` and returns `{ id }`; throws on Resend errors — options split into `options.ts` (dependency-free, read by `medusa-config.ts`) and `deliver.ts` (shared with the retry job); passes the notification key as Resend `idempotencyKey`
- [X] T004 [P] Register the notification module in `apps/backend/medusa-config.ts`: provider `./src/modules/resend` for channel `email` with options from env; keep the required-variables check unchanged (all new variables optional)
- [X] T005 [P] Formatting helpers `apps/backend/src/lib/emails/format.ts`: Polish date (`pt 24.10.2026`), window (`10:00–11:00`), deadline in Warsaw time (`pt 24.10, 14:30`), amount (`144,00 zł`), HTML escaping; unit tests in `apps/backend/src/lib/emails/__tests__/format.unit.spec.ts` (incl. DST day 2026-10-25)
- [X] T006 Layout and template registry `apps/backend/src/lib/emails/layout.ts` + `templates/index.ts`: one-column table layout (logo PNG, brand values from la-palette-garden `globals.css` with a source comment, footer with contact and reply-to), `renderTemplate(name, data) → { subject, html, text }`; unknown template → error
- [X] T007 Template data loaders `apps/backend/src/lib/emails/data.ts`: `loadOrderEmailData(container, orderId)` and `loadRequestEmailData(container, bookingId)` (fields per research R-07; pickup address from `loadOrderRules`; links from `STOREFRONT_URL` / `MEDUSA_BACKEND_URL`)
- [X] T008 Settings `apps/backend/src/lib/notification-settings.ts`: read `catering_staff_email` and `catering_staff_reminder_hours` (default 4, clamp 1–24) from store metadata
- [X] T009 Sending helper `apps/backend/src/lib/emails/send.ts`: `sendEmail(container, { template, to, data, resource, trigger, key })` → `createNotifications` with `channel: "email"`, `idempotency_key`; catches and logs errors (never throws to the caller, FR-008); `sendStaffEmail` resolves the staff address (missing → info log, skip)
- [X] T010 [P] Test provider for integration tests `apps/backend/integration-tests/utils/capture-notification-provider.ts` (records sent notifications in memory; optional failure switch) and wire it into the test app config when `TEST_TYPE` starts with `integration` — **replaced**: integration tests read the Notification Module's own records (template, recipient, data, status) — no capture provider needed; failure paths are unit-tested with fakes (`send.unit.spec.ts`, `deliver.unit.spec.ts`, `retry-failed-notifications.unit.spec.ts`)

**Checkpoint**: `pnpm run typecheck`, `pnpm run test:unit` green; app starts with and without `RESEND_API_KEY`

---

## Phase 3: User Story 1 - Order confirmation (Priority: P1) 🎯 MVP

**Goal**: every placed order produces one confirmation to the customer (and, US3, one staff e-mail).

**Independent Test**: complete a standard order → one `order-confirmation` with the right data.

### Tests for User Story 1

- [X] T011 [US1] Integration tests in `apps/backend/integration-tests/http/notifications.spec.ts` (helpers from `pickup-scheduling.spec.ts`): completing a cart sends exactly one `order-confirmation` to the cart e-mail with display id, term, pickup address, items, total, terms link; invoice data present when requested; re-emitting `order.placed` sends nothing new; with the provider set to fail the order still completes and the notification is `failure` — failure case covered at unit level (T010 note)
- [X] T012 [P] [US1] Unit test `apps/backend/src/lib/emails/__tests__/order-confirmation.unit.spec.ts`: subject, all required content of contracts/emails.md, escaping of customer-entered notes, plain-text part — all template unit tests in `__tests__/templates.unit.spec.ts` (also T016, T019)

### Implementation for User Story 1

- [X] T013 [P] [US1] Template `apps/backend/src/lib/emails/templates/order-confirmation.ts` per [contracts/emails.md](contracts/emails.md)
- [X] T014 [US1] Subscriber `apps/backend/src/subscribers/email-order-placed.ts` (`order.placed`): load data (T007), `sendEmail` `order-confirmation` with key `order-confirmation:<order_id>`, resource `order`

**Checkpoint**: US1 passes; checkout tests of 004/005 unchanged

---

## Phase 4: User Story 2 - Request e-mails (Priority: P1)

**Goal**: one customer e-mail per request state change.

**Independent Test**: send, confirm, decline, expire and cancel requests → one e-mail each.

### Tests for User Story 2

- [X] T015 [US2] Add to `notifications.spec.ts` (setup as in `pickup-requests.spec.ts`): send a request → `request-created` with deadline and status link `STOREFRONT_URL/catering/zapytanie/<cart_id>`; confirm → `request-confirmed` with payment deadline; decline → `request-declined`; expiry job → `request-expired` / `request-canceled`; paying a confirmed request → `order-confirmation` and no other request e-mail; repeating a job run sends nothing new

### Implementation for User Story 2

- [X] T016 [P] [US2] Templates `request-created`, `request-confirmed`, `request-declined`, `request-expired`, `request-canceled` in `apps/backend/src/lib/emails/templates/` + unit test of subjects and required content in `__tests__/request-templates.unit.spec.ts`
- [X] T017 [US2] Subscriber `apps/backend/src/subscribers/email-request-events.ts` for the five `catering.request.*` events (005 `src/lib/request-events.ts`): template by event, key `<template>:<booking_id>`, resource `pickup_request`

---

## Phase 5: User Story 3 - Staff notifications (Priority: P1)

**Goal**: staff hear about every new order/request and about undecided requests before they expire.

**Independent Test**: new order + new request → one staff e-mail each; undecided request → one reminder.

### Tests for User Story 3

- [X] T018 [US3] Add to `notifications.spec.ts`: with `catering_staff_email` set, a new order sends `staff-new-order` and a new request `staff-new-request` to it; without the address no staff e-mail and the customer e-mail still goes; `remind-staff-requests` handler with a request 3 h before its deadline (reminder hours 4) sends one `staff-request-reminder`, a second run nothing, a decided request none

### Implementation for User Story 3

- [X] T019 [P] [US3] Templates `staff-new-order`, `staff-new-request`, `staff-request-reminder` + unit test in `__tests__/staff-templates.unit.spec.ts`
- [X] T020 [US3] `email-order-placed.ts` + `email-request-events.ts`: also send the staff templates (keys `staff-new-order:<order_id>`, `staff-new-request:<booking_id>`)
- [X] T021 [US3] Job `apps/backend/src/jobs/remind-staff-requests.ts` (`*/15 * * * *`, research R-06), exported handler for tests
- [X] T022 [P] [US3] Admin widget `apps/backend/src/admin/widgets/notification-settings.tsx` (zone `store.details.after`, pattern of `min-order-value.tsx`): staff address (e-mail validation), reminder hours (1–24), save to store metadata

---

## Phase 6: User Story 4 - Reschedule and cancellation (Priority: P2)

**Goal**: the customer learns about a moved pickup or a cancelled order.

**Independent Test**: reschedule an order and a request, cancel an order → one e-mail each.

### Tests for User Story 4

- [ ] T023 [US4] Add to `notifications.spec.ts`: rescheduling an order (`/admin/catering/orders/:id/pickup-term`) and a request (`/admin/catering/requests/:id/pickup-term`) sends `pickup-rescheduled` with old and new term; a second reschedule sends a second e-mail; cancelling an order sends `order-canceled`

### Implementation for User Story 4

- [ ] T024 [US4] Emit `catering.pickup.rescheduled` (data-model "Event") at the end of `apps/backend/src/workflows/reschedule-order-pickup.ts` (after the step succeeds; add the name to `src/lib/request-events.ts` or a new events file)
- [ ] T025 [P] [US4] Templates `pickup-rescheduled`, `order-canceled` + unit test
- [ ] T026 [US4] Subscribers `apps/backend/src/subscribers/email-pickup-rescheduled.ts` (key `pickup-rescheduled:<booking_id>:<rescheduled_at>`, resource order or request) and `apps/backend/src/subscribers/email-order-canceled.ts` (key `order-canceled:<order_id>`)

---

## Phase 7: User Story 5 - Pickup reminder (Priority: P3)

**Goal**: one reminder the day before the pickup.

**Independent Test**: order for tomorrow placed > 24 h earlier → one reminder after 08:00 Warsaw.

### Tests for User Story 5

- [ ] T027 [US5] Unit tests `apps/backend/src/lib/emails/__tests__/pickup-reminders.unit.spec.ts` for the pure selection `selectPickupReminders(bookings, orders, now)`: before 08:00 Warsaw → none; tomorrow's active booking with order placed ≥ 24 h before the window → selected; placed < 24 h before → not; cancelled/rescheduled to a later day → not for the old date
- [ ] T028 [US5] Add to `notifications.spec.ts`: running the job handler twice for an eligible order sends one `pickup-reminder`

### Implementation for User Story 5

- [ ] T029 [P] [US5] Template `pickup-reminder` (with a map link to the pickup address)
- [ ] T030 [US5] Selection in `apps/backend/src/lib/emails/pickup-reminders.ts` and job `apps/backend/src/jobs/send-pickup-reminders.ts` (`5 * * * *`, key `pickup-reminder:<order_id>:<date>`)

---

## Phase 8: History, retries and polish

- [X] T031 Retry job `apps/backend/src/jobs/retry-failed-notifications.ts` (`*/15 * * * *`, research R-06 incl. the T001 decision; max 5 attempts in `data._attempts`) + integration test: provider fails, then recovers → the notification ends `success` — unit-tested; updates the failed row itself (research R-11); integration test of a real provider failure not added (no fault injection in the test app)
- [ ] T032 Admin route `apps/backend/src/api/admin/catering/notifications/route.ts` per [contracts/admin-api.md](contracts/admin-api.md) (validator in `src/api/validators/`, registered in `src/api/middlewares.ts`) + integration test
- [ ] T033 [P] Admin widget `apps/backend/src/admin/widgets/order-emails.tsx` (zone `order.details.side.after`): template label, recipient, time, status badge, attempts
- [ ] T034 [P] E-mail status per request in `apps/backend/src/admin/routes/pickup-requests/page.tsx` (last e-mail + failure badge)
- [X] T035 [P] Docs: `apps/backend/AGENTS.md` section "E-maile transakcyjne" (templates, triggers, keys, env, allow-list, how to add a template); README "Environments" — new staging variables; `.env.template`
- [X] T036 Run `pnpm run lint`, `pnpm run typecheck`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `pnpm run test:unit` in `apps/backend`
- [X] T037 Run `pnpm run test:integration:http -- integration-tests/http/notifications.spec.ts integration-tests/http/pickup-requests.spec.ts integration-tests/http/pickup-scheduling.spec.ts integration-tests/http/pickup-order-rules.spec.ts` (local PostgreSQL) and record results here (constitution VI) — 2026-10-26, local PostgreSQL 16: notifications **6/6**, pickup-requests **18/18**, pickup-scheduling **15/15**, pickup-order-rules **6/6** (45/45); unit 210/210; lint, both typechecks and `pnpm build` clean

## Phase 9: Go-live (needs the domain owner and Railway access)

- [ ] T038 Resend: create the account, add domain (`lapalettegarden.pl` or `mail.` subdomain, research R-10), add SPF/DKIM/DMARC records at the DNS provider, wait for "verified"
- [ ] T039 Railway staging: set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `STOREFRONT_URL`, `NOTIFICATION_ALLOWLIST` (team addresses); set the staff address in Admin → Settings → Store
- [ ] T040 Review all template texts with the manager (especially `order-confirmation`, `order-canceled` refund wording); run quickstart V1–V8 on staging incl. delivery to Gmail/Outlook/WP inboxes (SC-006)

---

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T010) → stories
- **US1** needs Foundational; **US2** needs Foundational (independent of US1)
- **US3** needs US1 + US2 subscribers (adds staff e-mails to them) and T008
- **US4**, **US5** need Foundational only
- Phase 8 after the stories it covers; T031 needs T001's decision
- Go-live (T038–T040) can start in parallel with development (DNS takes time); sending to real
  inboxes needs T038

### Parallel Opportunities

- T004 ∥ T005 ∥ T010 after T003
- Templates (T013, T016, T019, T025, T029) are independent files
- US4 and US5 in parallel with US2/US3
- T033 ∥ T034 ∥ T035

## Parallel Example: Templates

```bash
Task: "T013 order-confirmation template in apps/backend/src/lib/emails/templates/order-confirmation.ts"
Task: "T016 request templates in apps/backend/src/lib/emails/templates/"
Task: "T025 pickup-rescheduled and order-canceled templates"
```

## Implementation Strategy

### MVP

Foundational + US1 + US2 + US3 — the order confirmation is required to launch (consumer law),
request e-mails make the 005 flow usable without the status page, and staff alerts keep
requests from expiring unnoticed. Start T038 (DNS) on day one.

### Incremental Delivery

1. Foundational → US1 → deploy (log-only on staging until T038/T039)
2. US2 + US3 → deploy
3. US4 → US5 → Phase 8 → deploy
4. Go-live T038–T040 when the domain is verified
