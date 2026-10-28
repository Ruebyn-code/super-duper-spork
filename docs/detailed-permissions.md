# Detailed permission levels

Settings → Permission levels has 63 feature grants and 37 additional action controls. Search the levels by name/description, edit a manageable level or duplicate one as an unsaved draft. The editor groups permissions by feature, searches names/descriptions/IDs, filters enabled or detailed actions, and shows enabled counts. Groups can enable or clear the shown, grantable controls. View prerequisites are selected recursively, including multi-level leave-review dependencies. Save stays visible while the form scrolls. Cancel does not save.

Set a description, hierarchy, company/network scope and Staff/Manager Home independently. Company customisations remain local; publishing a network definition replaces its company overrides as before. Assignment still happens in Users. Current role limits apply to the next request, including unlocked kiosks; an old browser cannot bypass server checks.

Detailed controls include:

- Recording, editing, deleting and receiving saved orders, separately from placing supplier orders.
- Hourly/weekly report uploads and imports; invoice creation and removal.
- Creating/removing stock and suppliers, manual targets, user invitations/removal, location creation/archive/restore and company creation.
- Kiosk pairing/re-pairing and revocation, independently of ordinary settings edits.
- Publishing/archiving courses, training CSV exports, checklist planners, roster publishing and shift deletion.
- Company article removal and order email template edits.
- App reporting downloads/printing and each intelligence tool: search, checklists/planners, training/questions, Comms/Library writing, invoices, sales scans and scheduled reports.

Original feature grants remain in `permissions`. Optional `actionPermissions` boolean entries refine them through the shared browser/server model. An absent entry preserves legacy access, false denies that action, and true requires its original feature grant(s). This preserves customised roles without expanding their effective access or migrating accounts. New editor saves contain explicit action states. Descriptions and action limits survive edits from older clients that omit the new fields.

Effective actions participate in hierarchy/assignment checks, delegated role creation/editing/duplication and final full-owner protection. A manager cannot grant an action they lack through an omitted action map. Network policy recovery still uses the network owner’s authority even under a restrictive company override. Tenant permissions never confer platform owner/support authority.

`access-routes.actionPermission` supplements original route checks for individual actions. Domain writers also enforce saved-order, course, planner, roster, library and target-company account/kiosk limits. Location archive checks compare the requested state with the saved target. Existing immutable histories, revisions, idempotency, CSRF, required-reading and native queues remain in use. AI generation uses the existing provider ledger; denied generation makes no paid request. Individual sales/invoice reads and general builder drafts recheck current action permissions after slow calls; scheduled reports recheck the owner during generation and delivery. Denying intelligence search retains ordinary content search.

Export permissions control the app’s download/print actions, including the server’s training CSV endpoint. They do not conceal report values already authorised by viewing permissions. Other existing view, audience and company/location restrictions remain responsible for data visibility.

Validation: `node --test detailed-permissions.test.js permission-levels.test.js permissions.test.js ai-assistance.test.js`, followed by `npm test`. Use isolated accounts/data and fake providers. Check desktop/phone light/dark layouts, search/filter/group controls, recursive prerequisites, duplicate/cancel/one explicit Save, missing authority, target-company actions, native order/course actions, in-flight revocation, legacy omission compatibility and full-owner recovery. Build and start the production image before pushing.
