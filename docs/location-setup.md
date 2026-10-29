Head Office is an administrative company location and is exempt from the store setup checklist, pending tint and reminders. Select Head Office from the location selector to create/open it without a form, using native creation/all-location permissions. Ordinary stores still require all nine tasks. Existing Head Office setup/review records are preserved without requiring completion.

# Location setup

New locations retain their authenticated creator and saved setup checklist.
Existing locations and legacy migrations stay unchanged. Unfinished setup never
blocks platform access, including after a reminder expires. Existing completion
and review records are preserved.

Unfinished, accessible locations have a company-colour tint and “Setup in
progress” in the Locations directory and shared location selector. These markers
remain until an authorised manager explicitly finishes the validated checklist,
and clear across tabs and reloads. Status metadata is filtered by current company
and location access; it contains no sender keys, supplier contacts or payroll
data.

Creating a location opens a dismissible popup. Close and Escape return to the
current page. An optional five-minute reminder uses the existing server-timed
snooze record; it does not restrict access or hide the pending-location tint.

Every step opens an editor inside the popup. The existing forms run in isolated
same-origin documents, with navigation hidden and their own checked location
context. They reuse ordinary validation, permissions, CSRF, revisions, saving and
private credential handling. Opening or saving a step never switches the main
page’s selected location or navigates it into settings. Core location steps reuse
the single Save settings action. Other modules retain their normal explicit
save/autosave behavior. No orders, clock punches, checklist runs, training progress
or paid requests are created merely by browsing setup.

Popup editors retain unfinished drafts when returning to the checklist, switching
steps or closing the popup. Save or explicitly discard drafts before switching
location/company or reloading. Polling and cross-tab updates do not rebuild an
active editor. Current required Comms reading takes precedence, and existing
authorisation and reading checks still apply to every editor API.

The checklist has exactly nine tasks, in this order:

1. **Location name** — edit the name in the popup.
2. **Location state** — choose the Australian state or territory used for automatic public holidays.
3. **Trading hours** — save all seven days, including explicit closed days.
4. **Location manager** — assign an eligible existing user through the normal manager editor.
5. **First user** — create an account with a username, password, assignable permission level and optional phone number, or select an existing active user. Existing-user selection adds only the required location access and preserves their original default location, other memberships, roles, credentials and phone/PIN. Users who already have access need no account change. The chosen first user is saved explicitly; a manager assignment alone does not choose it.
6. **Employer setup** — confirm the location’s legal employer, award coverage, included native edition, pay-period start and weekly/fortnightly frequency. Optional super and on-cost estimates belong to this location. Uses the single Save settings action; requires award-management permission. The task is ready only after these settings are explicitly saved and native calculations are enabled. Staff hours are calculated separately for each saved location employer. Dated employee terms remain in Users.
7. **Ordering sending email** — save the sender and API key and enable automatic supplier emails. Credentials remain masked. This checks saved configuration without sending a test order or verifying the provider key.
8. **Manual target level entry** — enter initial whole-unit target levels for the location's stock. Zero is valid. The popup supports search and partial saves; it reuses ordinary per-item par writes and retains unfinished values if a save fails. Automatic target levels from completed usage remain read-only and count as ready. Stock counts and orders are never created by this step.
9. **Kiosk device** — show only a new-device form fixed to this location. It has no location picker, device list or management actions for other kiosks. Adding a device supplies a single-use pairing code/link; the new record counts as added while awaiting physical pairing. Creation retries retain the same device, refresh an unpaired device's code and never expose credential hashes or internal retry references. Pair it on the physical device to enable PIN sign-in.

First-user, par and kiosk editors use `GET /api/location-setup/steps/:locationId/:task`
with the setup location explicitly selected in `X-Location-Id`. First-user and
kiosk writes use POST on the same endpoint with CSRF; par writes reuse the
ordinary stock endpoint. Every request rechecks task permissions, current
location/company access, required Comms reading and unfinished setup. The editor
page can only be opened inside the authenticated setup popup. Read responses
include only the data needed for that step. Name, state and hours saves update
only that task's field, so retained drafts cannot overwrite other completed steps.

Tasks update automatically from saved data. The former supplier, catalogue,
roster, payroll, checklist and training review rows are no longer required.
Existing completed locations and stored historical review records stay intact.
Finish location setup rechecks all nine tasks and the current revision before
saving completion and attribution atomically in `location-setup.json`. Unsaved
editor drafts must be saved or discarded before finishing setup.

Automated tests use isolated temporary data and fake credentials. They cover
normal access with unfinished setup, reminders, highlights, completion, editor
location isolation, permission checks and the popup interactions on phone, tablet
and desktop.
