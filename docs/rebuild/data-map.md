# Data map and migration approach

## Where the data lives today

| Store | Shape | Scope |
| --- | --- | --- |
| `data/accounts.json` | Records with salted scrypt hashes, memberships, default location, employment profiles | Network, with per-company memberships |
| `data/locations.json` | Locations incl. `companyId`, trading hours, delivery plans, public holiday state, target-level system | Company |
| `data/companies.json`, `data/network-defaults.json` | Companies and network appearance defaults | Network |
| `data/catalogue.json` | `suppliers`, `products`, `imports` plus order price and edit audits | Company (catalogues split into `company-catalogues/`) |
| `data/sales/`, `data/location-sales/` | Per-location, per-week daily and hourly sales | Location |
| `data/weekly-sales-reports/` | Weekly report periods, channels, fees, expenses | Location |
| `data/stock-counts/` | Immutable saved counts with unit conversions and snapshots | Location |
| `data/invoices/` | Uploaded files, extracted fields, bundle week, price-update audit | Location |
| `data/rostering.json`, `data/award-compliance.json` | Shifts, publications, clock events, timesheets, pay snapshots, award settings | Company / location |
| `data/communications.json`, `data/communication-media/` | Posts, chats, reactions, read receipts, private media | Company / network, audience-scoped |
| `data/knowledge-library.json`, `data/learning-centre.json` | Articles, categories, courses, published versions, assignments, results | Company |
| `data/ops-management.json` | Checklists, planners, runs, answers | Company / location |
| `data/appearance.json`, `data/interface-text.json`, `data/element-overrides.json`, `data/layouts.json`, `data/fonts/` | Appearance, wording, per-element overrides, layouts, uploaded fonts | Company |
| `data/permission-levels.json` | Roles with `grants` plus 41 `actionPermissions` limits | Network / company |
| `data/kiosk-devices.json` | Paired devices, hashed codes and credentials | Location |
| `data/company-email-templates/`, `data/location-email/` | Sender settings and templates | Company / location |
| `data/profile-photos/` | Private avatars | Network |
| `data/award-compliance.json`, `data/employment-documents.json`, `data/employment-templates.json` | Employer setup, pay terms, issued contracts and signatures | Company / employer |

Roughly 34 JSON stores plus 16 record/media directories. Writes are atomic `0600` file replacements with serial revision queues per store.

## Current sandbox contents

The `data/` directory in this sandbox is a **fresh instance**, not production data:

- `accounts.json` — one account created for local access, no business history
- `catalogue.json` — seeded supplier/product records only
- `locations.json` — a single `admin` location
- no sales, orders, counts, invoices, rosters, messages, courses or documents

So the sandbox cannot supply the history that "migrate all data" refers to. The real records live in the deployment the business actually uses (`DATA_DIR`, per the README's Railway guide). A migration needs a copy of that folder; nothing in this repository contains it.

## Target entity map

Every scoped store gains the same three scope columns so row-level checks stay uniform.

| Today | Target entity | Scope columns | Notes |
| --- | --- | --- | --- |
| `accounts.json` | `Account` | `networkId`, `companyIds[]`, `locationIds[]` | Password hashes do not migrate into platform auth; accounts need a re-invite or a retained auth service. |
| `locations.json` | `Location` | `companyId` | Trading hours stay a nested structure; calculations stay in functions. |
| `companies.json` | `Company` | `networkId` | — |
| `permission-levels.json` | `PermissionLevel` | `networkId`, `companyId?` | `grants` + `actionPermissions` as JSON; enforcement in functions. |
| `catalogue.json` | `Supplier`, `StockItem` | `companyId` | Keep supplier SKU uniqueness and unit amounts. |
| orders (per-UUID JSON) | `Order`, `OrderEdit` | `companyId`, `locationId` | Preserve immutable snapshots, order numbers, fingerprints. |
| `sales/` | `DailySales`, `HourlySales` | `locationId`, `date` | One row per location/day; hourly as its own rows. |
| `weekly-sales-reports/` | `WeeklySalesReport` | `locationId`, `weekStart` | Derived totals recomputed, not migrated. |
| `stock-counts/` | `StockCount` | `locationId`, `savedAt` | Immutable; keep unit snapshots. |
| `invoices/` | `Invoice`, `InvoicePriceUpdate` | `locationId`, file storage ref | Binary moves to storage; keep content hashes. |
| `rostering.json` | `Shift`, `ShiftPublication`, `ClockEvent`, `Timesheet`, `Availability` | `companyId`, `locationId`, `userId` | Preserve frozen published snapshots and pay evidence. |
| `award-compliance.json` | `EmployerSetup`, `AwardVersion`, `PaySnapshot` | `companyId`, `locationId` | Calculation code retained; snapshots immutable. |
| `communications.json` | `Post`, `Conversation`, `Message`, `Reaction`, `ReadReceipt` | `companyId`/`networkId`, `audience` | Rich content as structured JSON blocks. |
| `knowledge-library.json` | `Article`, `ArticleCategory` | `companyId`/`networkId` | — |
| `learning-centre.json` | `Course`, `CourseVersion`, `Assignment`, `Attempt`, `Enrolment` | `companyId` | Published versions immutable; answer keys never returned to learners. |
| `ops-management.json` | `Checklist`, `ChecklistPlanner`, `ChecklistRun`, `ChecklistAnswer` | `companyId`, `locationId`, `audienceRoleId` | Runs immutable; step activity server-recorded. |
| `appearance.json` and friends | `Appearance`, `InterfaceText`, `ElementOverride`, `Layout`, `Font` | `companyId` | High volume, low logic. |
| `kiosk-devices.json` | `KioskDevice` | `locationId` | Store only credential hashes. |
| media directories | Storage objects | audience metadata | Private by default; access checked per audience. |

## Migration order

Dependencies run top-down; each step is idempotent and reversible until sign-off.

1. `Company`, `Location`, network defaults — the scope everything hangs from.
2. `PermissionLevel`, `Account` (identity only; credentials handled separately).
3. `Supplier`, `StockItem` — the catalogue.
4. `StockCount`, `DailySales`, `HourlySales`, `WeeklySalesReport`.
5. `Order`, `OrderEdit`, order numbers and price audits.
6. `Invoice` + storage objects + price-update audits.
7. `EmployerSetup`, employment terms, `Shift`, publications, clock events, timesheets, pay snapshots.
8. `Article`, `Course` (+ versions), `Assignment`, `Attempt`.
9. `Post`, `Conversation`, `Message`, media objects.
10. `Checklist` history, `Layout`, `ElementOverride`, `Appearance` — cosmetic last.

## Migration rules

- **Dry run first.** Read-only pass that reports counts, orphans, and fields with no target.
- **Idempotent.** Every record has a stable natural key (`networkId + companyId + legacyId`) so a re-run updates rather than duplicates.
- **Referential checks.** Every `companyId`/`locationId`/`userId` must resolve; unresolved records are reported, never silently dropped or reassigned.
- **Totals reconciliation.** Recompute weekly sales, cost of goods, budgets and pay totals from migrated records and compare against the source app's own numbers. A mismatch blocks cut-over.
- **Immutable history stays immutable.** Published rosters, issued contracts, approved timesheets, saved counts and completed checklist runs migrate as frozen records with their original timestamps and hashes.
- **Files by content hash.** Invoice originals, chat media, avatars, fonts and employment documents transfer with checksum comparison; no re-encoding.
- **Nothing is deleted from the source.** The existing app and its `data/` folder stay untouched and read-only as the rollback reference until sign-off.
- **Credentials are not migrated.** Password hashes are not portable into platform auth; accounts need an invitation or a retained auth service — a decision for the user, not a default.
