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

Automatic tasks inspect saved state/territory, seven days of trading hours, a
manager, team access, sending service, supplier delivery contacts and the stock
catalogue. Sending credentials are required only for configured email/text
routes; platform-only orders need no sending key. Five additional tasks require
explicit review of rostering/labour, awards/payroll, checklist planners,
training/induction and kiosk needs. Reviews are setup acknowledgements, not
claims of payroll compliance, completed training or delivered physical prints.
Finish location setup rechecks all tasks and the current revision before saving
completion and attribution atomically in `location-setup.json`.

Automated tests use isolated temporary data and fake credentials. They cover
normal access with unfinished setup, reminders, highlights, completion, editor
location isolation, permission checks and the popup interactions on phone, tablet
and desktop.
