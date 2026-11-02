# Opstack → Base44-native rebuild: inventory and mapping

First deliverable of the approved rebuild plan. It records what Opstack actually is
today (read from this checkout and the running instance), then maps each part to the
Base44-native building block it would become.

Everything under **Verified inventory** was measured in this repository. Everything
under **Proposed mapping** is a proposal — none of it exists yet.

## Verified inventory

| Measure | Value | How it was measured |
| --- | --- | --- |
| Server-side JavaScript | ~14,600 lines in the repository root | `cat *.js \| wc -l` |
| Main HTTP entry point | `server.js` (128 KB) | file size |
| HTML pages served | 29 (`public/*.html`) | `ls public/*.html` |
| Front-end assets | 288 files in `public/` (136 MB incl. media) | `ls public \| wc -l`, `du -sh` |
| Persisted JSON stores | 39 distinct store filenames | `grep -rhoE "'[a-z0-9-]+\.json'"` |
| Test files | ~120 `*.test.js` files | directory listing |
| Runtime dependencies | one (`date-holidays`) | `package.json` |
| Base44 SDK or CLI | none present | `ls node_modules`, `which base44` |

### How it is built today

- **One Node process.** `server.js` starts the HTTP server; routing and route-level
  permission checks live in `opstack-router.js` and `access-routes.js`.
- **Persistence is JSON files.** Each module owns a file under `DATA_DIR` (the
  `opstack-data` volume at `/data`), written with temp-file-plus-rename and a
  per-file in-process queue (`auth.js`, `catalogue-store.js`).
- **Authentication is first-party.** `auth.js` keeps accounts in `accounts.json` with
  `scrypt` hashes, cookie sessions and invitations (`account-invitations.js`), plus a
  device-bound kiosk PIN flow (`kiosk-devices.js`, `kiosk-policy.js`).
- **Authorisation is a custom permission tree**, not record ownership:
  `permissions.js` with `permission-levels.json` defines named levels, and access is
  scoped by company → location → user (`companies.js`, `locations.js`,
  `location-scope.js`).
- **No component framework and no client-side router.** Each HTML page loads a
  hand-written ES module (`public/home.html` → `home-layout-model.js`, …) plus shared
  `app-layout.js` and `appearance-style.js`.

### Screens (`public/*.html`)

`index`, `home`, `opstack`, `login`, `setup`, `accept-invite`, `cart`, `order-history`,
`stock-count`, `stock-transfers`, `wastage`, `labels`, `sales`, `reporting`,
`communications`, `rostering`, `award-settings`, `ops-management`, `learning-centre`,
`knowledge-library`, `employment-documents`, `help`, `admin`, `accounts`, `settings`,
`settings-hub`, `location-setup-step`, `kiosk`, `kiosk-devices`.

### Stores that would become entities

| Area | Stores today | Notes |
| --- | --- | --- |
| Identity | `accounts.json`, `users.json`, `permission-levels.json` | scrypt hashes, invitations, custom levels |
| Tenancy | `companies.json`, `locations.json`, `location-email/*` | company → location tree, trading hours |
| Ordering | `catalogue.json` (66 KB seeded), `order-numbers.json`, stock counts, transfers, wastage | totals recalculated server-side |
| Sales | weekly reports, hourly sales, operating-expense schedules | Excel import, projections |
| Rostering / awards | `rostering.json`, `award-compliance.json` | award rules engine |
| Comms | `communications.json`, email settings and templates | outbound email |
| Content | `knowledge-library.json`, `learning-centre.json`, `employment-documents.json`, `in-store-training.json` | media and documents |
| Appearance | `appearance.json`, `layouts.json`, `interface-text.json`, `element-overrides.json`, `fonts.json`, logos | per-company theming and wording |
| Platform | `platform.json`, `network-defaults.json`, `scheduled-ai-reports.json`, `ops-management.json` | |

### Integrations that are not self-contained

Outbound email (`network-emails.js`, `order-confirmation.js`, `scheduled-report-email.js`),
Stripe (`opstack-stripe.js`, `stripe-billing-model.js`), documented GoCardless history
(`docs/gocardless.md`), OpStack intelligence via OpenAI (`ai-assistance.js`,
`ai-report-model.js`), spreadsheet/PDF/ZIP handling (`weekly-sales-import.js`,
`invoice-bundle-zip.js`), and 136 MB of media including help videos.

## Proposed mapping (not built)

| Today | Base44-native |
| --- | --- |
| `accounts.json` + `auth.js` sessions | Base44 authentication; a user record carries role, company and location |
| `permission-levels.json` + `access-routes.js` | RLS per entity plus backend functions for checks RLS cannot express |
| 39 JSON stores | Entities that keep the existing JSON field names |
| `opstack-router.js` route table | Backend functions, each mirroring its route's permission requirement |
| `public/*.html` + hand-written modules | React pages sharing one layout, one page per current HTML file |
| Award rules, imports, exports | Backend functions — pure computation, ports with its tests |
| Stripe, email, AI, media | Connectors or backend functions with stored credentials |

### Where a straight port is hard

1. **The award engine.** `fast-food-award.js` (43 KB) plus `award-compliance.js` (29 KB)
   with 85 KB of tests encode penalty rates, breaks and entitlements. It must port
   behaviour-for-behaviour; it is computation, so it belongs in backend functions.
2. **Permissions.** Company/location scoping with fine-grained keys is richer than
   per-record RLS, so it needs a shared permission-check function behind the entities.
3. **Runtime appearance and wording.** `element-overrides.json` and
   `interface-text.json` let Head Office restyle and reword the UI live; a React rebuild
   needs a deliberate equivalent or that feature regresses.
4. **Kiosk PIN sessions.** Device-bound auth with employee PINs has no direct Base44
   equivalent and needs a backend-function design.
5. **Volume.** 29 screens and 39 stores is a multi-phase project, not one change.
