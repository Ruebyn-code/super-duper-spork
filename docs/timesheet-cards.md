# Timesheet cards

Rostering → Timesheets presents individual vertical cards in a responsive grid,
with multiple cards beside each other on larger screens and one column on phones.
Each card keeps its staff header, times, totals, checks and actions together. The header uses
existing company fonts/colours, the permitted staff photo (initials if unavailable),
date, source, saved status and published position. Actual clock-in/out, paid time
and unpaid breaks remain recorded work; planned breaks never become actual events.

Clocked entries compare against the saved timetable from clock-in. A manual entry
may match a single overlapping published shift for that employee, provided another
non-rejected record does not fragment that shift. Ambiguous, missing and unmatched
references show unavailable hours/variance, not zero. Draft shifts never supply the
comparison. Melbourne overnight/DST durations use the native elapsed-time model.
Variance compares paid hours after unpaid breaks, with differences of a minute or
more called out for review; it is not an automatic wage or break correction.

Wage cost uses the existing scoped amount; approved records keep their frozen
calculation. Card checks contain only that entry's current warnings and applicable
general warnings, plus missing clock-out, over-24-hour and roster-variance checks.
The UI counts recorded issues, never a fabricated number of passed checks or a
payroll certification. The separate top disclosure retains general setup issues.

Authorised reviewers open the existing correction form from Correct or either
clock-time value. The separate Breaks editor saves actual paid/unpaid intervals with its own reasoned
audit. Start/finish corrections require a reason and
explicit Save correction, reopens approved work and leaves original events/history
intact. Pay details retains actual allowance/break facts and award review rules.
Approval still obtains fresh native checks and the existing review/fingerprint;
blocking card issues disable its shortcut without waiving server validation.
No inline edit, card opening, expansion, photo fetch or view change writes work.

Staff retain only their own authorised entries, recorded/published times and
history. Wage fields, approval, corrections and pay details keep existing scopes.
Photo metadata is added only after the native location directory is filtered;
photo bytes retain their existing protected endpoint. Every card stacks its
fields and permitted totals above its checks and actions.
Existing filters, week/location selection, CSV export and annual-leave accrual
continue through their original writers and approved snapshots.

## Published shifts and dollar variance

`scheduledTimesheets` is a separate read-only dashboard DTO. It derives assigned
published shifts for this location/week and the authorised employee audience;
vacancies and drafts are excluded. It never creates attendance, a pay approval,
financial totals, leave accrual or CSV work rows. Linked clock entries and uniquely
matched manual entries suppress a duplicate planned card. Ambiguous/split manual
work stays separate rather than inventing an association. Add worked times is an
explicit, reasoned native manual entry after the planned finish, with zero actual
unpaid breaks until confirmed; planned times are suggestions, not evidence.

Gross dollar variance is recorded wage cost minus the saved roster estimate,
including native penalties, allowances and minimum payments in those amounts.
The published pay snapshot or its historical legacy rate supplies the plan cost;
unpublished edits never do. New clock entries privately capture that cost at
clock-in. Missing/changed legacy references, incomplete calculations and open
actual records have unavailable dollar variance. Known zero remains zero. All
cost and comparison fields keep existing money permissions. A variance does not
change a wage, authorise a deduction or certify what an employee must be paid.

## Actual breaks and record integrity

Breaks has separate Add/Remove, paid-rest/unpaid-meal and actual timestamp fields.
New rows require an explicit paid/unpaid choice, never a default wage deduction.
Closed real records can be edited by native timesheet reviewers. Scheduled cards
show only their published plan; active clocks remain in the existing clock flow.
The live POST preview clones state and uses the native employer-wide award engine;
it never saves, reviews a calendar, approves work or calls a provider. The source
edition and all applicable native warnings stay visible. A real short/late break
can be recorded and flagged, rather than falsified to match the award timetable.

Save breaks requires current company/location, CSRF, native authority, exact
revision, a reason, non-overlapping intervals inside the actual shift and no more
than 24 intervals. Replacing a legacy untimed unpaid total requires explicit
confirmation. `breaksOverride` holds the corrected intervals; raw `entry.breaks`
and original clock timestamps remain intact. Only unpaid intervals reduce paid
hours. Actual timestamps own meal placement/rest counts once present; stale manual
break facts cannot override them. Other allowances and genuine written variations
remain unchanged. Start/finish corrections preserve valid timed breaks and cannot
erase or move them outside work; use Breaks to change their amounts.

Changes return the record to pending and retain original clock events, before/
after intervals, actor, reason, time and the previous frozen approved calculation
in its audit. History shows the correction evidence. A new approval still requires
fresh native checks and a current fingerprint/review. Missing source, employment
or reviewed holiday calendars cannot be waived by a review note. Paid rests,
minimum engagements, overtime, penalties and actual recorded time remain inputs
to the existing engine; a work-times IFA does not waive breaks.

## Australian requirements and limits

The retained MA000003 July 2026 edition (clause 14, with the edition/date guards in
`fast-food-award.js`) supplies the break rules: paid 10-minute rests, applicable
30–60-minute unpaid meals, first/last-hour and separate-break conditions, and no
more than five hours worked without a meal. The native calculation also retains
its part-time agreements, employer-week/cycle, junior, public holiday, penalty and
minimum-payment checks. Actual historical exceptions remain visible; approving
wages is not a declaration that a break breach or employment arrangement is lawful.

Fair Work Act 2009 s 535 requires employment records for seven years. This workflow
keeps original events and dated, attributed, reasoned corrections with before/after
evidence and has no timesheet-delete or automatic purge action. Operators must
retain the underlying records and accessible backups for the required period;
this feature alone does not ensure backup, payslip, tax, state child-employment,
award-coverage/classification or every other employer obligation.

Sources: the retained `docs/awards/ma000003-2026-07.pdf`,
https://awards.fairwork.gov.au/MA000003.html and
https://www.fairwork.gov.au/pay-and-wages/paying-wages/record-keeping .
External legislation was not fetched in this environment; the included edition
is explicitly versioned and future unsupported dates remain unavailable.

The current platform time/day model is Australia/Melbourne. Locations in other
trading time zones need independently verified local-time handling before relying
on these estimates for payroll penalties or calendar boundaries. This update does
not reinterpret historical rosters or certify interstate payroll calculations.
