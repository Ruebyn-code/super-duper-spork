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
regular working hours when added. Nothing changes the employer’s award configuration.
Pay Conditions follows a two-column layout with Industry award, Employment type,
Classification / level, Allowances and the existing pay arrangement. Pay Rates is
a full-width box below the fields, with a one-column phone form. Hourly rates
update automatically from unsaved DOB, employment type, classification and pay
arrangement selections; saved terms are shown until a field changes. The read-only panel shares the
native calculator’s junior bases, casual loading, ordinary weekday/weekend,
public-holiday and night percentages, and cent rounding. Dates can be inspected
without changing account or employment data. A birthday or later effective
profile selects the correct rate for that date. Shift overtime, allowances and
other recorded conditions remain with the existing full shift calculator.

The company must enable native award calculations through the existing Employer
setup, including confirmed coverage and a weekly/fortnightly pay-period anchor.
Setup and previewing never enable this automatically. Missing profiles, older or
expired editions, special arrangements and below-minimum agreed bases show
required setup instead of a guessed rate. Above-award agreed bases retain their
saved terms and native calculation rules. No automatic rate is copied into the
legacy flat-rate table; existing company configuration and historical approved
calculations remain unchanged.

Managers with awards.manage can edit employment and view the calculated panel.
Those with rostering.view and rostering.costs can read only the rate summary for
users at their accessible selected location. The server response contains rates,
source metadata and setup issues, never DOB, employment patterns, profile lists,
other employees or audit data. Both saved reads and draft previews calculate only. They never start a feed,
save settings, create a shift or change another employee’s rates.

Unsaved changes immediately hide stale figures, then update the labelled draft
preview. Saving refreshes the summary from the confirmed employment record. Rate-date selection and Refresh do not dirty the employment draft
or submit the account form. Missing access remains a manager-help message.
Skipping unchanged employment fields is allowed; the ordinary user editor can
complete them later. Roster setup never changes staff availability, clocks time,
or sends a second invitation.

Finish user setup closes the checklist. Closing after creation and with no
unsaved roster draft also releases the popup; existing saved records remain.
The ordinary pencil editor, profile photos, invitation resends, filters and
directory remain available. Existing users are not enrolled in a new checklist.

Automatic rates use the employee’s accessible assigned location and show its name. Complete employer coverage and pay-period details through that location’s Employer setup tab or location setup checklist. Employee dated employment terms remain here.

Employment type and award classification must be chosen explicitly for new profiles. The form groups essential employee/pay details and expands additional employment conditions when saved non-default values need attention. Award Overview can open the same editor without granting account-management permissions.

## Live pay selection preview

`POST /api/awards/rates/:userId/preview` takes a bounded `{date,profile}` body,
requires awards.manage and CSRF, and reuses the saved-read location/employee
access checks. Only allowlisted employment fields are accepted; employer settings
and the included source always come from storage. Private DOB and pattern values
never go in the URL or return DTO. Responses contain only derived rates, source,
location/date, preview status and setup messages. There are no file writes, audits,
feeds, provider calls, rate copies or operational records. Cost-only readers keep
the saved GET endpoint and cannot post draft employment terms.

The preview reuses native junior bases, loadings, percentages and cent rounding.
It needs DOB, employment type, classification/band and a supported pay basis;
missing employer/source/date coverage, unsupported arrangements and below-award
bases withhold numbers. Ordinary rates may be shown before a part-time pattern
or remaining employment dates are finished: those requirements appear separately
under Employment setup. Dates and other required pay details still block saving;
regular working hours can be added later, but complete part-time shift costs
remain unavailable until written hours and an agreement reference are saved.
No pattern, start date, salary or other unsupported arrangement is invented.
Laundry appears separately as a weekly or per-shift allowance, not in hourly pay.

## Allowances during staff onboarding

In the new user's Roster details step, open **Allowances** in Pay Conditions and
tick the relevant choices. Existing employees use the same chooser through
Users → pencil → Pay Conditions. Choices include uniform laundry, cold/freezer
work, own-vehicle deliveries/other duties, extra travelling time, overtime meals
and work expense reimbursements. **Save employment details** commits the choices
to the dated company employment profile. Opening the chooser and previewing
rates only change the current draft; account saves and invitations remain separate.

Uniform laundry retains the native per-engagement or weekly award calculation
and appears separately in Pay Rates. Other selections identify usual work
conditions, and the preview labels them **Actual work in Timesheets**. They do
not guess kilometres, minutes, expenses, notice, meal eligibility or supplied
meals. Those facts are confirmed through Timesheets → Pay details → **Actual
allowance details and reimbursements**, with a reason before approval. The
calculator still pays recorded eligible work even when its category was not
selected at onboarding. Broken Hill remains location/calendar-based.

Roster Pay details contains breaks and optional written variations, plus a staff
settings shortcut, without allowance-entry controls. Saving those roster fields
preserves all existing allowance facts. Native API writers remain compatible;
moving an existing shift to another person/date retains the existing stale-fact
clearing rules. Saved and approved histories are never rewritten by the chooser.

`allowanceSelections` is an allowlisted, duplicate-free array. `laundersUniform`
remains the compatible calculator flag; conflicting explicit values are rejected.
Older employment writers preserve existing selections when they omit the array,
and an explicit legacy laundry flag changes only that selection. New effective
dates inherit omitted selections; an explicit empty array clears them. Standard
employment authority, scope, CSRF, profile revisions and audits still apply.

Inputs debounce for 250 ms, immediately hide stale figures, abort prior work and
ignore late responses. Changing the employment effective date updates the preview
date. Date-only inspection remains read-only. Preview inputs do not rebuild form
fields, save drafts or clear setup dirty state. Closing/discarding retains native
guards; only Save employment details applies the terms through normal revisions.


## Optional regular working hours

For part-time staff, **Add regular working hours** replaces the always-visible
seven-day form. Existing saved hours open for editing. The button reveals the
written agreement reference and Monday–Sunday hours with native meal/overnight
fields. **Remove regular working hours** excludes those terms from the current
draft; re-adding before saving restores the same field values. Switching
employment types also preserves in-memory hours until an explicit save.

Staff employment details can be saved without regular working hours. When hours
are added, the full written agreement, seven-day pattern, paid minimum engagement,
meal timing and matching weekly minutes are still validated. Only the normal
**Save employment details** action writes the dated profile, with existing
permissions, revision checks and audit history. Adding/removing never writes on
its own and retains native unsaved-change guards.

Saved and draft ordinary hourly rates do not require a work pattern; the pay box
shows remaining setup separately. Full native part-time shift costs, overtime
checks and approval still require the written hours and agreement. Missing hours
remain unknown, never zero or an assumed schedule. Approved pay snapshots stay
frozen. The internal `pattern` data keys and existing historical profiles remain
compatible; there is no availability or roster creation from staff setup.


## Grouped employee settings

The pencil beside an existing user opens a native **User settings** popup, named
for that employee, with the existing settings menu:

- **Personal** contains the existing photo, name, sign-in email, phone, permission
  scope and location access controls.
- **Pay Conditions** lazily loads the existing dated Employment & award editor
  only with awards.manage. Dates, classifications, live rates, optional Regular
  working hours and explicit Save employment details remain native.
- **Time & Attendance** shows the phone-derived clock PIN, the existing Timesheets
  link with roster access, and an authorised shortcut to Regular working hours.
- **Leave & Availability** links to the existing roster leave and availability
  screens when roster viewing is permitted. It does not invent employee-specific
  leave balances, change availability or submit a request.

The desktop popup has a company-styled vertical menu beside an independently
scrolling settings panel. Phones stack the same labelled menu above the fields
in a scrolling body. The employee heading and native save/close controls remain
visible. Keyboard Up/Down/Home/End selects groups. Original controls stay mounted
when switching so account, photo and pay drafts keep their values. Opening groups
or following the hours shortcut never saves or calls providers.

Account saves validate only original account controls and reveal Personal for
invalid fields; an unconfigured award profile does not prevent unrelated
account maintenance. Unfinished pay/photo drafts must be saved or explicitly
cancelled before an account save can close the editor. Employment saves do not
save personal account fields. Existing server permissions, location/company
scopes, CSRF and revisions remain authoritative. Busy saves freeze category and
close actions; cancel/navigation guards protect drafts. Reset restores the same
original form nodes and validation mode for the five-step invitation popup.
The limited Award Overview editor and new-user checklist retain their existing
workflows and do not gain account-editing permission from the new groups.

Close, Escape, Cancel edit and a click on the backdrop share the existing
unsaved-change confirmation. Busy account, employment, document and photo work
cannot be closed. Native account errors and the permitted Remove/Resend actions
remain inside the popup; successful account changes return to the directory.
Closing restores focus to the pencil and returns the original form/actions to
their directory slots, so opening another user or Create user cannot duplicate
controls or carry the previous staff member's draft. The persistent shell's
shared navigation is inert while a modal is open. Opening or switching settings
never writes an account, employment profile or operational record.

## Individual Flexibility Agreements

Pay Conditions offers Add Individual Flexibility Agreement (IFA), scoped to the
employee’s selected employer location. Record the signed original’s reference,
signing/start/end dates, varied terms, changes and better-off-overall assessment,
and confirm signatures (including a parent/guardian where required), retention
and the employee copy. The legal employer is taken from saved Employer setup.
The existing Save employment details commits the record; preview/add/remove are
draft-only. Other employer locations’ records remain mounted and unchanged.

An active, confirmed work-times-only IFA explicitly permitting roster-based hours
replaces the fixed part-time hours requirement for that employer. It does not
waive standard award wages, penalties, minimum engagements or daily/weekly
overtime. Timesheet costs require that employer location’s published roster;
actual work outside roster windows attracts overtime. Other pay variations remain
unsupported and require separate review. Expired, future or different-employer
IFAs do not bypass missing regular hours. See docs/awards/README.md.

## Employment agreements during staff onboarding

After inviting a user, save their employment details and select reviewed contract
and IFA templates in the Roster details step’s Employment documents panel. The
same panel is in existing employee Pay Conditions, with an email-style shared
template editor, saved staff/pay autofill and Review selected documents → Send
selected documents. Template editing needs company-wide employment authority;
selection uses native staff/employer-location access. Pay saves never send emails.
My agreements retains individual drafting and signing history. They must activate
the invited OpStack account before viewing or signing. Login directs pending
employee signatures to onboarding and Home lists outstanding signing tasks.
Each signer uses their own account and fresh email verification; guardians need
a separate appropriately limited account. See [Employment agreements](employment-documents.md).
