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

1. Settings → Award compliance → Employer setup: confirm coverage and the legal
   employer. All locations in one company are combined as one employer. Separate
   legal employers must be separate companies.
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
   Part-time users require a seven-day written work pattern, meal timing and an agreement reference; keep the original
   agreement in the employer's records. Classification decisions are made by the
   employer using clause 12, not inferred from a user's app role.
5. Roster → Award checks → Pay details: review estimates and enter break timing,
   eligible allowances, reimbursements and any written part-time variation.
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
| Overtime triggers | 10.9, 13, 20.2–20.4; pp. 9–12, 24–25 | 11 ordinary h/day; 38 ordinary h/week or configured 1–4-week cycle; combined company locations; FT/PT five-day default; PT pattern and recorded variations; FT actual work outside published roster |
| Minimum engagement | 10.2, 11.3 | PT/casual 3h; additional payment does not alter work timestamps |
| Isolated Sunday overtime | 20.5 | Four-hour minimum, unless the manager records adjacent ordinary work |
| Breaks | 14; pp. 13–14 | Paid 10-minute rests, 30–60-minute unpaid meals, five-hour gaps and first/last-hour checks; roster meal timing is an explicit midpoint estimate if omitted |
| Broken Hill / cold work | 17.2–17.3; pp. 16–17 | $47.90/week once per user/employer/week; 38c/h cold or total 97c/h below 0°C, on qualifying minutes |
| Overtime meals | 17.4; p. 17 | $17.33 first meal unless supplied; further $15.66 after >4 eligible overtime h; recorded eligibility/notice and inability to return home required |
| Uniform laundry | 17.5; pp. 17–18 | $6.42/week FT once per employer/week; $1.28/shift PT/casual, only if employee launders required clothing |
| Travel, vehicles, reimbursements | 17.5–17.10; pp. 17–19 | Extra travel time at base/150%; own vehicle delivery 53c/km or other duties $1/km; actual reimbursements with a reason |
| Rate rounding | Schedule A; pp. 42–48 | Junior base rounded to cents first; each percentage then rounded half-up to an hourly cent; line amounts rounded to cents |

Work is evaluated in Australia/Melbourne, including DST. The app's ordinary
week is Monday–Sunday. Rate bands split across midnight and birthdays. Overtime
counters combine locations belonging to the employer; reporting costs stay with
the shift's location. Overnight shifts' *displayed weekly total* belongs to the
week in which the shift started; the engine's daily/cycle counters use the local
date of each worked segment. Cycle anchors and complete work records are
essential for averaging. Partial cycles remain estimates.

Actual breaks come from clock events; marked paid rests remain paid time. Manual
time does not invent break timestamps. Adjacent records are grouped as one continuous engagement, with the minimum-payment top-up on the last record. Isolated Sunday overtime is checked even when work continues into Monday. Minimum-payment top-ups use the highest
rate encountered in the engagement: mixed-band short engagements require review.
Weekly allowances are allocated to the first qualifying shift chronologically,
across employer locations. Copied/moved assignments do not carry individual
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
  accident pay, leave/loading, termination and redundancy.
- NES, state-specific employment/public holiday/child-employment obligations,
  tax, payslips, pay runs, bank payments, STP and payroll lodgements.
- The award refers super obligations to legislation and does not supply a
  statutory percentage. Optional super is an **estimate** on ordinary-time wage
  lines, including ordinary minimum-payment top-ups, excluding overtime and all
  allowances. Actual OTE, allowance treatment, eligibility and payment deadlines
  need separate review. Other on-costs are a user-configured gross percentage.
  Neither is included in the gross-wage roster/budget total.
- Public holidays and conditional allowance facts are not guessed. A maintained
  holiday calendar and truthful work records remain required. Updates to this
  document do not arrive automatically from the Fair Work Commission.
