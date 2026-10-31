# Timesheet cards

Rostering → Timesheets presents one compact card per work record. The header uses
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
clock-time value. Break details shows recorded paid/unpaid events and can open the
same audited correction for unpaid minutes. A correction requires a reason and
explicit Save correction, reopens approved work and leaves original events/history
intact. Pay details retains actual allowance/break facts and award review rules.
Approval still obtains fresh native checks and the existing review/fingerprint;
blocking card issues disable its shortcut without waiving server validation.
No inline edit, card opening, expansion, photo fetch or view change writes work.

Staff retain only their own authorised entries, recorded/published times and
history. Wage fields, approval, corrections and pay details keep existing scopes.
Photo metadata is added only after the native location directory is filtered;
photo bytes retain their existing protected endpoint. Phone cards stack their
fields/actions; desktop cards place permitted totals alongside the recorded work.
Existing filters, week/location selection, CSV export and annual-leave accrual
continue through their original writers and approved snapshots.
