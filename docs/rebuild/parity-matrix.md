# Opstack → Base44 parity matrix

Baseline measured from this repository at commit `7e503aa` (branch `base44/setup-065a9c9a`).

| Measure | Value |
| --- | --- |
| Backend modules (root `*.js`, excluding tests) | 128 |
| Backend source size | ~1.13 MB |
| Pages (`public/*.html`) | 29 |
| Frontend scripts (`public/**/*.js`) | 187 (~10.6k lines) |
| Test files (`node --test`) | 141 |
| Permission identifiers (`public/permission-model.js`) | 102 |
| Runtime npm dependencies | 1 (`date-holidays`) |
| File-backed stores + record/media directories | ~34 JSON files, 10+ directories |

The app is a single-process Node HTTP server with a custom router (`opstack-router.js`), hand-rolled scrypt session auth, and JSON files as the database. No ORM, no external database.

## Target column meanings

- **Entity** — maps to a record collection with row-level scoping.
- **Function** — needs server-side logic (function or retained service).
- **Static page** — presentation only; portable.
- **Redesign** — depends on something the platform does not model; parity needs a design decision, not a port.

## Matrix

| Domain | Code | What it does today | Target | Parity risk |
| --- | --- | --- | --- | --- |
| Foundations | `auth`, `account-invitations`, `password-security`, `login-limiter`, `permissions`, `permission-levels`, `access-routes`, `platform-identity`, `opstack-router`, `opstack-store`, `public-files`, `runtime-config`, `archived-collections`, `global-search`, `persistent-shell`, `public-assets` (21 files, ~135 KB) | Scrypt sign-in, 8-hour sessions, invitations, 102-key permission catalogue, company/location scoping, routing, asset serving | Entity + Function + Redesign | **High.** Built-in auth does not carry a 102-key permission graph, per-company/location scoping, invitation-version invalidation or session revocation. Needs its own account/session/permission entities plus a function-side check on every write. |
| Server / ops | `server.js` (127 KB), `ops-management` (47 KB) | Route dispatch, validation, CSRF, per-domain orchestration, owner console, checklists | Function (split) | **High.** 174 KB of orchestration must be decomposed per domain; one monolithic function is not viable. |
| Ordering & catalogue | 22 files, ~89 KB (`catalogue-store`, `catalogue-import`, `stock-order-rules`, `par-levels`, `manual-par`, `order-*`, `supplier-*`, `delivery-*`, `target-calculations`, `prep-labels`) | Catalogue, ordering rules (minimum, multiples, custom/split cutoffs), cart, purchase requests, order numbering, delivery planning, snapshotted prices | Entity + Function | **Medium.** Data maps well. Rule engine, price snapshots and delivery weekdays must stay server-side. |
| Stock | 5 files, ~38 KB (`stock-counts`, `stock-usage`, `stock-transfers`, `stock-transfer-effects`, `wastage`) | Count entry/history, usage and par maths, transfers, wastage | Entity + Function | **Medium.** Transfers mutate two locations in one transaction; needs a function, not client writes. |
| Sales & reporting | 21 files, ~151 KB (`sales`, `hourly-sales*`, `weekly-sales-*`, `xlsx-values`, `reporting*`, `operating-expense-*`, `holiday-projections`, `home-*`) | Daily and hourly sales, weekly Excel import, cost of goods/labour/Op Ex, projections, quarter dashboards | Entity + Function + Static page | **Medium.** Reporting is derived — recompute in functions rather than migrating totals. XLSX parsing is hand-rolled (`xlsx-values.js`), so it must run in a function. |
| Invoices | 5 files, ~36 KB + browser OCR bundles in `public/vendor/invoice/` | Upload/scan, OCR, extraction, weekly bundles, SKU price matching, applied-price audit | Entity + Function + Storage | **Medium.** OCR is bundled and runs in the browser — portable as-is. Files move to object storage; price-application history needs its own entity. |
| Workforce | 18 files, ~237 KB (`rostering*`, `roster-positions`, `staff-availability`, `timesheet-records`, `award-*`, `fast-food-award`, `annual-leave`, `leave`, `employee-benefits`, `employment-*`) | Rosters and publishing, availability, clock events and breaks, timesheets, MA000003 pay estimation, leave and super, contracts | Function (retained) + Entity + Storage | **Very high.** Largest and most legally sensitive block. The award engine is versioned calculation code with frozen approval snapshots; it must be preserved verbatim as a service, not re-expressed as entity rules. |
| Comms & learning | 8 files, ~92 KB (`communications*`, `communication-media`, `knowledge-library*`, `learning-centre`, `in-store-training`, `help-media`) | Posts, direct/group chat, reactions, required-read gating, articles and categories, courses, quizzes, assignments, reports, help guides | Entity + Function + Storage | **Medium.** The rich-content block model (tables, accordions, callouts, media) has no platform equivalent — store as structured JSON. Required-read blocking needs a function-level gate. |
| Appearance | 7 files, ~24 KB + `interface-labels.json` (206 KB) | Brand colours/fonts/logos, per-element overrides, saved layouts, editable interface text | Entity + Storage | **Medium.** High record count, low logic. |
| Billing | 4 files, ~48 KB (`opstack-stripe`, `stripe-billing-model`, `stripe-customer-model`, `opstack-monthly-reports`) | Owner-only console billing: sandbox/live secrets, checkout, quantities, idempotency, signed webhooks, monthly reports | Function + Connector | **High.** Needs outbound HTTP and signature verification, plus the user's Stripe keys before it can be exercised at all. |
| Kiosk & clock | `kiosk-devices`, `kiosk-policy`, `public/clock-model` (~9 KB) | Paired shared devices, PIN identification, lock policy | Entity + Function | **Low–medium.** PIN hashing and device scoping stay server-side. |
| AI assistance | 9 files, ~64 KB (`ai-*`, `scheduled-reports`, `scheduled-report-email`) | Drafting, question generation, report summaries, search, scheduled emails | Function + Connector | **Medium.** Needs a model provider credential; scheduled email needs an email provider. |
| Locations | `locations`, `location-setup`, `location-scope`, `location-managers` (~21 KB) | Locations, Melbourne trading hours with overnight days, manager assignment, setup wizard | Entity + Function | **Low.** Well bounded; trading-hours logic stays in a function. |
| Misc | `network-emails` | Network email settings | Entity | **Low.** |

## Gap register

No direct platform equivalent — each needs a decision before any porting starts:

1. **Custom permission graph (102 keys).** Platform roles are insufficient. Decision: permission keys as an entity plus a function-side `can()` check on every write path.
2. **Custom scrypt auth with session versions.** Either adopt platform auth and re-implement version-based revocation, or retain the existing auth as a service.
3. **MA000003 award engine with frozen pay snapshots.** Retained as calculation code with immutable snapshots; cannot become declarative rules.
4. **Bundled browser OCR.** Portable, but the vendor assets must ship as static files.
5. **Rich-text block document model.** Store as JSON; no platform editor equivalent.
6. **Required-post gating that blocks API access.** Function-level gate, not a UI modal.
7. **Stripe billing console.** Requires real keys; cannot be verified without them.
8. **JSON-file durability semantics** (atomic `0600` writes, idempotent migrations). Must map to entity transactions and unique constraints, or stay in a service.
9. **Cross-location transactional writes** (stock transfers, roster publication, price application). Must not become client-side multi-writes.
