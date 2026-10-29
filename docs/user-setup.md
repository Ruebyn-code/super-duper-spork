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
under Before saving and continue to block normal saving/complete shift costs.
No pattern, start date, salary or other unsupported arrangement is invented.
Laundry appears separately as a weekly or per-shift allowance, not in hourly pay.

Inputs debounce for 250 ms, immediately hide stale figures, abort prior work and
ignore late responses. Changing the employment effective date updates the preview
date. Date-only inspection remains read-only. Preview inputs do not rebuild form
fields, save drafts or clear setup dirty state. Closing/discarding retains native
guards; only Save employment details applies the terms through normal revisions.
