# User setup

Users → Create user opens a company-styled native popup with five checklist steps:

1. Name and sign-in email.
2. Optional phone number and its native clock/kiosk PIN preview, or Skip for now.
3. An assignable permission level and company/network scope.
4. Accessible locations and a default included in that selection.
5. Roster details, available after creating the account.

Continue validates the visible step and records its current draft values as
reviewed. Changing those values clears that step’s check. Back to checklist and
Close retain the same form and draft in memory on this page; Discard draft clears
it. Navigation/context changes are guarded while an invitation or unsaved roster
draft is pending. No user is created while opening or completing draft steps.

After reviewing the first four steps, Review invitation shows their summary.
Only Send invitation uses the existing account-invitations API. Native hierarchy,
email/phone uniqueness, detailed creation permission, company/location, CSRF and
required-reading checks remain authoritative. The form is frozen while sending,
and a completed invitation cannot be sent again from the setup popup. Delivery
status distinguishes accepted, failed and unconfirmed sends; pending accounts
remain unable to sign in until they choose their password from the setup link.

Once the account is created, the fifth step opens inside the popup. Managers
with awards.manage use the existing Employment & award editor, including dated
employment, DOB, employer-selected classification, pay arrangement and written
part-time pattern. Nothing changes the employer’s award configuration.
Managers with rostering.view and rostering.costs can save the new user’s dated
flat hourly rate separately at each assigned location in the current company.
Each save sends only that user and location through the existing revision-checked
rates API, preserving every other employee’s rate. Native award costing hides
the flat-rate inputs. Missing rates remain unknown; zero is explicit.

Roster edits require their native explicit saves before Continue. A conflicted
or unconfirmed rate save keeps the draft and offers Check latest rate before
retrying. Skipping unchanged roster fields is allowed; editing the existing user
or Labour settings can complete them later. The popup never schedules shifts,
changes staff availability, clocks time, or sends a second invitation. Roster
permissions do not follow automatically from user-management permission.

Finish user setup closes the checklist. Closing after creation and with no
unsaved roster draft also releases the popup; existing saved records remain.
The ordinary pencil editor, profile photos, invitation resends, filters and
directory remain available. Existing users are not enrolled in a new checklist.
