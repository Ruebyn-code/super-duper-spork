# MA000003 native calculations

The bundled `ma000003-2026-07.pdf` is the document supplied by the user. It is the
Fair Work Commission consolidation through **1 July 2026**, incorporating
PR799280, PR799284 and PR799442. SHA-256:
`fae4ca2b8dc7b5e902daf80ef91e63f2104637affd28be074aa79a1ce0478583`.

The executable edition is `MA000003-2026-07-v1` in `fast-food-award.js`. There is
no external provider, scraping, OCR or model inference in wage calculations.
New official award variations require a reviewed calculator update. Generic
JSON check imports remain available, but do not alter this engine's pay tables.

## Set up in the app

1. Admin → Locations → Edit location → **Employer setup**, or the Employer
   setup step inside a new location’s setup popup. Enter this location’s legal
   employer and explicitly confirm coverage. Use the popup’s single **Save settings**
   action. Each saved location is a separate employer calculation context, even
   when display names match. Its settings do not change another location.
2. Enable checks and the included native edition. Enter a known pay-period
   start and weekly/fortnightly frequency. July rates start at the first full
   pay period beginning on or after 1 July 2026. Earlier periods need an earlier
   edition; these rates are never silently backdated. A review cutoff of
   1 July 2027 is an application guard, **not a statutory expiry date**.
3. Public holidays: review each location/year, including regional, part-day and
   substitute days. Only enter the day/period to which the holiday penalty
   applies under clause 27.3; do not double-enter original and substitute days.
4. Users → edit user → Employment & award: enter dated employment details,
   classification, DOB, pay arrangement and applicable conditions. These are
   private employer records, independent of application permission levels.
   Regular working hours are optional in staff setup: choose Add regular working
   hours when ready. Complete part-time shift costs require seven-day
   written hours, meal timing and an agreement reference, or a current signed
   working-hours-only IFA permitting roster-based hours at this employer; keep the original
   agreement in the employer's records. Classification decisions are made by the
   employer using clause 12, not inferred from a user's app role.
   User setup and the employment editor display read-only automatic hourly rates
   from saved terms or a clearly labelled preview of unsaved selections. The preview shares native junior/loading/penalty
   helpers, uses the selected date, and preserves missing setup/source guards.
   It never stores a flat-rate copy or enables employer coverage.
Roster makers can also open Pay details directly from a shift’s visible cost.
Staff view shows the saved costs for each employee’s selected week. Missing
employment, source or calendar details stay unknown and show their blocking
reasons; the display never guesses a zero or enables award settings.

5. Select staff allowances during onboarding or in Users → Pay Conditions.
   Roster → Pay details uses saved settings and accepts break timing or optional
   written variations. Variable allowance quantities, reimbursements and meal
   conditions are confirmed in Timesheets → Pay details after the work.
   Published rosters supply the ordinary window for full-time actual work.
6. Clock paid rest and unpaid meal breaks separately. For manual/corrected
   timesheets, enter the meal start in Pay details. Approvals with missing pay
   inputs are blocked. Review notes record decisions on other warnings; they
   do not replace an employee agreement or certify legal compliance.

## Source map

| Calculation / check | Source | Treatment |
| --- | --- | --- |
| Adult classification and two Level 3 bands | 12, 15.1; PDF pp. 11, 14 | $27.81 / $29.45 / $29.91 / $30.27 base hourly |
| Juniors | 15.2; p. 15 | Under 16: 40%; ages 16–20: 50–90%; adult from 21st birthday |
| Casual loading | 11.2; p. 10 | 25 percentage points; never multiply penalties by 1.25 |
| Late evening / early morning / weekends / holidays | 21; p. 27 | Split by local time and holiday period; Level 1 Sunday differs from Levels 2/3 |
| Overtime rates | 20.6; pp. 25–26 | Mon–Sat first 2h 150%, later 200%; Sunday 200%; PH 250%; casual +25 points; no ordinary penalty stacking |
| Overtime triggers | 10.9, 13, 20.2–20.4; pp. 9–12, 24–25 | 11 ordinary h/day; 38 ordinary h/week or configured 1–4-week cycle; combined employer work; FT/PT five-day default; PT pattern and recorded variations; FT actual work outside published roster |
| Minimum engagement | 10.2, 11.3 | PT/casual 3h; additional payment does not alter work timestamps |
| Isolated Sunday overtime | 20.5 | Four-hour minimum, unless the manager records adjacent ordinary work |
| Breaks | 14; pp. 13–14 | Paid 10-minute rests, 30–60-minute unpaid meals, five-hour gaps and first/last-hour checks; roster meal timing is an explicit midpoint estimate if omitted |
| Broken Hill / cold work | 17.2–17.3; pp. 16–17 | $47.90/week once per user/employer/week; 38c/h cold or total 97c/h below 0°C, on qualifying minutes |
| Overtime meals | 17.4; p. 17 | $17.33 first meal unless supplied; further $15.66 after >4 eligible overtime h; recorded eligibility/notice and inability to return home required |
| Uniform laundry | 17.5; pp. 17–18 | $6.42/week FT once per employer/week; $1.28/shift PT/casual, only if employee launders required clothing |
| Travel, vehicles, reimbursements | 17.5–17.10; pp. 17–19 | Extra travel time at base/150%; own vehicle delivery 53c/km or other duties $1/km; actual reimbursements with a reason |
| Rate rounding | Schedule A; pp. 42–48 | Junior base from weekly rate ÷ 38 × age percentage, rounded to cents first; each percentage then rounded half-up to an hourly cent; line amounts rounded to cents |

Work is evaluated in Australia/Melbourne, including DST. The app's ordinary
week is Monday–Sunday. Rate bands split across midnight and birthdays. Overtime
counters stay within each explicitly configured location employer; reporting costs stay with
the shift's location. Overnight shifts' *displayed weekly total* belongs to the
week in which the shift started; the engine's daily/cycle counters use the local
date of each worked segment. Cycle anchors and complete work records are
essential for averaging. Partial cycles remain estimates.

Actual breaks come from clock events or explicitly confirmed, reasoned timed
corrections. Marked paid rests remain paid time. Manual time does not invent break
timestamps. The separate Timesheets Breaks editor previews native checks without
provider polling, retains originals and reopens approval; see
[Timesheet cards](../timesheet-cards.md). Adjacent records are grouped as one continuous engagement, with the minimum-payment top-up on the last record. Isolated Sunday overtime is checked even when work continues into Monday. Minimum-payment top-ups use the highest
rate encountered in the engagement: mixed-band short engagements require review.
Weekly allowances are allocated to the first qualifying shift chronologically,
within the employer context. Copied/moved assignments do not carry individual
written variations or allowance confirmations to a different user/date.

Missing inputs elsewhere in an employee’s cycle or engagement also prevent complete calculation. Legacy flat-rate approvals are flagged for reopening and review when the native engine is enabled.

Approved native calculations retain their source ID, line amounts, profile ID,
fingerprint and review audit. New work or changed employment/rates can affect
weekly overtime/allowances: a changed calculated result warns the reviewer to
reopen affected approvals. Frozen approvals are not silently rewritten.

## Scope that still needs employer/payroll review

This is a roster/timesheet wage estimator, **not complete payroll or a legal
compliance certificate**. The full source is retained for obligations that cannot
be established from recorded shifts:

- Coverage, classifications, reasonable overtime, required notices, written
  agreements, consultation, right to disconnect and other procedural duties.
- Six-day/four-day arrangements are not automatically interpreted. The default
  is five ordinary days, with additional days costed as overtime; review any
  permitted exception separately.
- Individual flexibility, TOIL, training wages (including the external
  Miscellaneous Award schedule), supported wages, higher contractual benefits,
  accident pay, actual leave pay/loading, termination and redundancy.
- NES, state-specific employment/public holiday/child-employment obligations,
  tax, payslips, pay runs, bank payments, STP and payroll lodgements.
- The award refers super obligations to legislation. Standard eligibility and the
  12% rate are now automatic planning estimates; ordinary cold/regional allowances
  are included when their allocation is known. Unsupported allocations remain
  unavailable. Contribution caps, payroll remittance and non-standard eligibility
  remain outside the estimator. Annual leave has verified ordinary-hour tracking
  and a separate provision, not actual leave pay. See [employee benefits](../employee-benefits.md).


## Location settings and compatibility

`award-compliance.json` retains dated employee profiles, holiday calendars and
reviewed rule versions within the company. Its `locationEmployers` records hold
only each location’s employer configuration, independent of the legacy company
configuration. Native roster, timesheet and hourly-rate readers use the selected
location’s employer. Work from other separately configured employers cannot
supply overtime counters, continuous engagements, weekly allowances or missing
context. Super and on-cost percentages are also local. Employee employment terms
remain dated company records in Users; the rate preview identifies its location.

The location editor uses the scoped `/api/awards/locations/:id/employer` GET/PUT,
requires `awards.manage` and current accessible active company/location scope,
and returns no employee profiles, holiday calendars or audit records. Saves use
the existing company revision and atomic queue; stale writers cannot overwrite
changed employment/calendar/settings data. Browsing never writes. Award compliance
retains edition, rule, calendar and history tools and links to location setup.

Untouched legacy company employer settings keep their former shared calculation
context. Reading does not migrate them. The editor shows these existing values
for review; an explicit Save settings creates a separate location record and
calculation context. Existing approved pay snapshots stay frozen and native changed-
context warnings still require reopening and review. Already completed location
setup records remain complete; unfinished ordinary locations need the new ninth
Employer setup task. Head Office remains exempt.

## Simpler setup and review

Award compliance opens a read-only Overview, grouped by accessible trading
location: Employer, Employees and Public holidays for the current Melbourne year.
It reads saved details without configuring employers, creating profiles, reviewing
calendars or fetching a provider. Ready for estimates means setup completeness
for today, within the listed scope; it does not certify award or legal compliance
or promise that future/historic shifts have complete inputs. Head Office has no
store setup. Legacy company setups remain identified.

Employer setup stays inside the location popup with one Save settings action.
The automatic-wages switch controls native checks and wage calculations together;
existing checks-only configurations remain unchanged until explicitly switched.
Coverage and edition review stay explicit. Optional super/on-cost estimates are
expandable, and open for saved values. Employee type and classification require
an explicit choice for new profiles. Ordinary employment details and automatic
rates are prominent; special conditions, cycle averaging and rate breakdowns are
expandable, preserving saved values and all validations. Employee edits are also
available directly in Overview through the same dated editor and awards.manage
permission; this never grants account creation, role or email authority.

Holiday rows default to compact all-day entries; part-day controls open for saved
partial periods. All dates, regional/substitute/part-day review and the explicit
whole-year confirmation remain required. Refreshes preserve unsaved calendar
changes; stale calendar revisions must be reloaded explicitly. Roster review groups
repeated messages while retaining affected-record counts and all blocking details.
Pay details show breaks and totals first, with itemisation, allowances and written
variations expandable. Existing allowances, agreements and warning review notes
are preserved; no unsupported obligation is automatically waived.

### Source audit and calculation corrections

`ma000003-2026-07-rates.json` transcribes every Schedule A table, with the retained
PDF digest. Tests independently compare **560** published ordinary, penalty and
overtime entries for all four classification bands, adult/junior ages and
permanent/casual employment. Clauses 15.1 note 1 and 15.2 require the junior base
from the **unrounded weekly rate / 38**, then its age percentage and cent rounding,
before penalties. Applying the age percentage to the rounded adult hourly rate
was corrected: for example Level 3 in charge of one/no person at age 16 is a
$14.95 base and $18.69 casual weekday rate; Level 3 in charge of two/more people
at age 20 is a $27.25 base and $34.06 casual weekday rate.

Overnight work now rechecks changed employment terms at each local date. A new
special arrangement, missing classification band, incomplete supplied hours or below-
minimum agreed rate after midnight withholds a complete cost instead of using
standard terms through the shift. Existing ordinary/junior birthday splits,
source dates, pay-period guards, overtime, breaks and conditional allowance tests
remain. Approved snapshots are not rewritten; native changed-context warnings
still require reopening and review.

This audit uses the **included 1 July 2026 edition**, not a live certification of
later variations. Coverage, classification duties, regional exceptions, special
agreements, payroll/NES and procedural obligations still need employer review.

Employee Pay Conditions and its full-width Pay Rates box now preview ordinary hourly amounts as type/classification/DOB and allowance selections change. This is a calculation only; full employment validation and explicit saves still apply. See [user setup](../user-setup.md#live-pay-selection-preview).


Regular working hours are optional when saving an employee profile. Omitted
hours/reference/minutes remain unset and are reported as missing by native full
shift costing; they cannot be waived by a review note. Supplied hours retain full
validation. Saved hourly-rate summaries may show the ordinary rate without hours,
with the missing agreement in `setupIssues`, just as draft previews do. This does
not make the employee ready for complete native shift costing or change approved
snapshots. Existing pattern fields and dated records remain compatible.

## Recorded Individual Flexibility Agreements

`flexibilityAgreements` belongs to the native dated employee profile, with one
record per employer location. The shared employment editor adds/removes the
selected location’s record and preserves other locations. Writes require current
awards.manage, native CSRF, company/user membership, location access, assignment
and a matching saved legal employer; the native revision queue saves the record
and private before/after audit atomically. Older writers omitting the field retain
existing agreements, including when creating a later dated profile. Explicit
removal is required. Reads and previews never save, sign or certify an agreement.

The retained award’s clause 5 permits specific individual flexibility arrangements.
The app records the signed original’s reference, dates, terms, changes and
better-off-overall assessment, with employer confirmation of signatures (including
parent/guardian when required), retention and employee copy. These records do not
replace the original or prove legal validity.

Only a current, confirmed work-times-only record explicitly permitting rostered
hours replaces fixed part-time hours in native calculation. It must match the
shift’s location, legal employer and each worked date. Rosters use their saved
shift windows; actuals use only published windows at that same employer location.
No published roster remains unknown. Outside-window work, daily/weekly limits,
five-day default, minimum engagements, penalties, breaks and allowances retain
standard award treatment. A visible, non-blocking IFA review notice remains.
Other varied pay terms withhold costs pending a separately reviewed calculation;
there are no custom percentages or blanket overtime waivers. Expiry, changed
employers and dated terms are rechecked across midnight. Approved snapshots remain
frozen, with normal changed-context warnings. The one-off shift variation remains
optional; its disabled hidden fields do not participate in form validation.

### Automatic planning calendars and staff readiness

Native roster costing now accepts ephemeral state holiday calendars from the
server-owned `award-roster-planning` helper. Confirmed location/year calendars win;
unconfirmed drafts cannot replace automatic state estimates. Dates cover the
shift and extra-travel years. Missing state plus no confirmed calendar still
withholds costs. The calculator uses the same selected calendar at validation,
holiday/part-day rate boundaries and travelling-time calculations. Broken Hill is
never inferred from NSW.

This fallback is exclusively for `mode: roster`. Actual timesheet calculations,
calendar confirmations, employer setup and frozen approvals retain their existing
guards. Planning provenance appears as a nonblocking notice in Pay details.

The scoped saved/preview rate DTO includes `rosterSetup` readiness, combining all
ordinary rate issues, complete employment requirements and holiday availability.
No private profile, agreement reference or calendar audit is added to this DTO.
Readiness is setup completeness for a date/location, not certification of legal
compliance or a substitute for actual-work facts and future award reviews.
