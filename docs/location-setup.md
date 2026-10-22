# New location setup

Creating a location through the app or its API records the authenticated creator
on that location. The initial location of a newly created company does the same.
Existing locations and legacy account-location migrations are left unchanged.

Only the creator is blocked, across every location in that company. Colleagues,
other companies and platform support are unaffected. The parent navigation shell
opens the setup checklist on creation, navigation, sign-in or reload. Closing it
or disabling JavaScript does not bypass the server's `428 LOCATION_SETUP` gate.
Normal configuration APIs retain their existing permissions and remain available
so setup can be finished; operational APIs remain blocked.

The seven automatic checks require saved location details/state, all seven days
of trading hours (including explicitly closed days), a manager, an active team
member, enabled sending credentials for the suppliers’ email/text routes (platform-only orders need no sending key), supplier delivery contacts and a priced
stock catalogue. The five additional required tasks explicitly confirm review of
rostering/labour, awards/payroll, checklist planners, training/induction and kiosk
needs. These are setup reviews, not claims of payroll compliance, completed
training/checklists or successful physical device operation. They do not create
shifts, assignments, checklist runs, clock punches, orders or deliveries. Settings
open through ordinary permission-checked editors for the new location. Authorised
colleagues can open Setup checklist from the Locations directory and help finish
reviews without being blocked themselves. Roles lacking a task's normal
management grant must ask an authorised colleague to configure/review it.

Finish location setup rechecks all automatic requirements and all reviews. It
requires location management, location/company access and the current checklist
revision. Client-supplied completion flags are ignored. Completion and review
attribution are saved atomically in `location-setup.json`; later routine settings
edits do not reopen a completed onboarding checklist. Archiving an unused location
removes it from the pending list under the existing archive rules.

Snooze grants exactly five minutes to that creator in that company, measured by
the server clock. It persists across tabs, sign-in and restarts, cannot be extended
by retrying before expiry, and does not cover locations added after that snooze.
At expiry the popup returns and operational APIs block again. Another explicit
five-minute snooze is available. The browser rechecks on focus/visibility, after
navigation, across tabs and periodically; a server-aligned timer also reopens the
popup when the tab is idle. Required Comms reading takes precedence.

The setup response contains task status and permission-aware editor links, never
provider keys, supplier contact details or payroll data. Setup reads send no
emails and make no provider calls. Automated tests use temporary data and fake
credentials. Older feature fixtures explicitly invoke the normal snooze when
their scenarios need access after adding a location; setup's dedicated tests use
native requests to exercise the unsnoozed gate.
