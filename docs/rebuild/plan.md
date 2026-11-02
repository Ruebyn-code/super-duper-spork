# Rebuild plan

Approved target: full feature parity, all data migrated.

## Phase 0 — Inventory (done)

Artifacts: `parity-matrix.md`, `data-map.md`, and this plan. Establishes what exists, what maps, what does not, and what must be decided before writing code.

## Phase 1 — Foundations

Accounts, companies, locations, permission levels (63 grants + 41 optional action limits), sessions, invitations, and the scope check every write path will call.

**Gate:** a user signs in and sees only their company and location data; a delegated limited manager cannot exceed their granted actions.

**Status: built and passing** in `rebuild/` (own service, host port 3001), beside the current app. Reuses `public/permission-model.js`, `password-security.js` and `account-invitations.js` rather than re-deriving them, and adds `rebuild/access.js` as the guard every write calls. Gate covered by `rebuild/test/foundations.test.js` (10 tests) plus HTTP checks. See `phase-1.md` for evidence and the deliberate limits — no permission-level editor, no email delivery of invitations, no user removal yet.

## Phase 2 — Ordering and stock

Catalogue, ordering rules, cart, purchase requests, order history, stock counts, usage targets, transfers, wastage, delivery planning.

**Gate:** count → recommendation → cart → order, with snapshotted prices, plus a transfer that debits and credits two locations atomically.

**Status: built and passing** in `rebuild/` (host port 3001). Catalogue, ordering rules, stock ledger, counts, transfers, wastage, the order sheet, the cart review and deliveries. Reuses `public/stock-order-rules.js`, `par-levels.windowFor()` and `order-numbers.prefix()`; every two-location transfer and every order confirmation is one store transaction, and each placed order keeps its price snapshot. Gate covered by `rebuild/test/ordering.test.js` (9 tests) plus HTTP checks — see `phase-2.md` for evidence and the deliberate limits (no supplier sending, no delivery plans, no server-side cart).

## Phase 3 — Sales and reporting

Daily and hourly sales, weekly Excel import, operating expenses, projections, budgets, quarter dashboards, reporting.

**Gate:** imported weeks reconcile to the source workbook and drive the same forecasts as the current app.

**Status: built and passing** in `rebuild/` (host port 3001). Daily and hourly sales, the weekly report import, expenses, budgets and the financial week reuse `sales.calculate()`, `hourly-sales.forecast()` and `holiday-projections`; Reporting is read-only and leaves incomplete locations unranked. Gate covered by `rebuild/test/sales.test.js` (6 tests) and `rebuild/test/reporting.test.js` (2) — see `phase-3.md` for evidence and the deliberate limits (CSV import only, no XLSX/PDF/photo readers, add-only expenses).

## Phase 4 — Invoices

Upload and scan, browser OCR, extraction, weekly bundles, SKU price matching, authorised price application with audit.

**Gate:** an invoice applies prices once, is blocked when stale, and shows its history on reopen.

**Status: built and passing** in `rebuild/`. Automatic SKU-then-name matching, a differences-only comparison, one confirmation that writes the price and its audit in one transaction, and a live invoice-only Cost of goods. Gate covered by `rebuild/test/invoices.test.js` (5 tests) — see `phase-4.md` (no upload/OCR; the reviewed lines are supplied).

## Phase 5 — Workforce

Rosters and publishing, availability, clock and breaks, timesheets, award estimation, leave and super, employment documents.

**Gate:** a published week costs the same in the rebuilt app as in the current one for identical inputs; approved pay snapshots stay frozen after later rate changes.

**Status: built and passing** in `rebuild/`. Every cost comes from `fast-food-award.calculate()` and `award-break-plan.build()`; publication and approval freeze their output, a published week refuses edits until withdrawn, and publishing without a reviewed calendar is refused. Gate covered by `rebuild/test/workforce.test.js` (5 tests) — see `phase-5.md` (per-shift roster form, no accrual report or document signing).

## Phase 6 — Comms, library and learning

Posts, chat, required-read gating, articles and categories, courses, quizzes, assignments, progress reporting, checklists.

**Gate:** required reading blocks access until acknowledged; a failed quiz keeps answers and grades on the server.

**Status: built and passing** in `rebuild/`. The reading gate runs before every private page but Comms and the migration console, answer keys never reach a learner, attempts are graded against the assignment's frozen version, and checklist step times are server-stamped. Gate covered by `rebuild/test/comms.test.js` (4 tests) and `rebuild/test/learning.test.js` (5) — see `phase-6.md` (plain-text content, single-choice questions).

## Phase 7 — Migration and reconciliation

Dry run, then the ordered import in `data-map.md`; count, referential and totals reconciliation.

**Gate:** every store reconciles, every unresolved record is listed, and the source data is still untouched.

**Status: built and passing** in `rebuild/` (`/migration`, Head Office only). The dry run writes nothing, the import is idempotent on stable natural keys, orphans block sign-off instead of being dropped, and the source directory is never written. Gate covered by `rebuild/test/migration.test.js` (4 tests) and an HTTP dry run → apply → cut over → rollback run — see `phase-7-8.md`. Still outstanding: a copy of the production data to rehearse against.

## Phase 8 — Cut-over

Only after Phase 7 sign-off. The existing app is retired to read-only, not deleted.

**Status: built and passing** in `rebuild/`. Retirement needs a reconciled latest run with no orphans, records who signed off and which run they relied on, and can be rolled back to rehearsal; the source data is never touched. Covered by the same migration tests and the HTTP run in `phase-7-8.md`.

## Decisions needed before Phase 1

These are not implementation details — they change what users can do:

1. **Where the new app is built.** Base44-native entities require creating the app in the Base44 builder. This repository's sandbox runs its own Node stack and exposes no Base44 entities or SDK, so parity work cannot be delivered from here as platform-native pages.
2. **Authentication.** Platform auth cannot carry the 102-key permission graph or session-version revocation on its own. Either keep the existing auth as a service behind the platform, or re-implement revocation on platform auth.
3. **Award compliance engine.** Retain the calculation code as a service. Re-expressing MA000003 rules declaratively would change pay outcomes and is not acceptable.
4. **Production data.** A copy of the live `DATA_DIR` is required. This sandbox holds a fresh instance only.
5. **Integrations.** Stripe, Resend (email) and intelligence keys are stored per company in the app today; they will need re-entry in the new app, and Stripe webhooks need a reachable endpoint.

## Estimated effort

Measured against the inventory: ~28k lines of application code across 128 backend modules and 187 frontend scripts, 141 test files, and 16 record/media stores. This is a multi-month rebuild with a team, not a single-session port. Phases 1–2 alone are the size of a small app.
