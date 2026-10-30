# Roster cost popups

The desktop/tablet roster maker opens an authorised shift’s saved cost from a small dollar
icon on its card, with the employee’s whole-week total beside their name in Staff
view. Stacked cards use the same icon and retain per-day totals. Day timeline bars label
the whole shift cost, including a continuing overnight shift; these are not
additional daily expense allocations.

The amounts use existing server-calculated native award costs, or existing
dated legacy hourly rates when that company uses flat-rate costing. This
display adds no rates, changes no award settings and never guesses missing
amounts. Unknown costs stay unknown; an actual zero is displayed as $0.00.
Staff with no shifts have a $0.00 planning total. A total with any unpriced
shift is unavailable rather than a misleading sum of only the priced shifts.

Click the dollar icon to open native Pay details, with gross wages, separate
super/on-cost estimates and the expandable Itemised calculation. The card shows
no inline amount. The icon retains the current cost in its accessible name. Blocking reasons are visible
there when the calculator cannot price the work, including missing employment
terms, source/pay-period coverage or a location state/reviewed holiday calendar. Legacy shifts
without a rate show a read-only explanation and the existing award-settings
destination when authorised. Merely opening details never saves or publishes.

Small red award error icons on staff rows and shift cards open a separate,
read-only review of the current native checks. Staff icons cover the selected
week; shift icons cover that shift plus applicable staff/general checks. The
compact popover replaces the large top Roster warning panel, while native Pay
details, publishing review and Timesheets approval guards stay unchanged.
Unknown checks without a visible owner retain a small status-row fallback icon.
Icons with unsaved changes are disabled so they do not present stale reviews.

Edits disable the icon with an Updating cost accessible label until the native serial save and recalculation finish.
Staff totals update alongside saved shift costs without replacing active input
fields. Failed or uncertain saves keep their existing draft/error/undo handling.

Wage visibility follows existing server DTOs and roster permissions. Ordinary
staff do not receive new cost fields. The phone published-team reader retains
its existing private schedule-only data, without attaching draft shift prices
to published shifts. Financial expense reports, approved wage snapshots,
budgets, pay rules, native validation and employer-wide costing are unchanged.

Choose allowances in onboarding or employee Pay Conditions. The roster cost
popup has a Staff allowances shortcut and no allowance-entry controls. Break and
variation saves preserve previously recorded allowance facts. Variable quantities
and meal conditions are confirmed in Timesheets → Pay details → Actual allowance
details and reimbursements. Uniform laundry continues to cost automatically from
the saved dated profile; other selections never invent amounts or waive an
entitlement for actual work.

Roster-only holiday estimates fall back to the automatic state calendar, including
part-day periods, travel dates and overnight year boundaries. A confirmed saved
calendar takes priority. Pay details shows the automatic-calendar provenance
without adding a publication error. Actual timesheet approvals still require
reviewed calendars; automatic generation never changes stored settings or approved
snapshots. Staff Pay Conditions shows the remaining setup blockers before a
manager finishes onboarding.

### Tabbed shift overview

Saved roster-card dollar icons open Costs in the native company-styled overview;
select Details to edit the shift. Six labelled keyboard tabs retain the original
shift/pay fields: Details, Breaks, Costs, Notes, Warnings and Status. Timesheet Pay
details keeps its existing actual-work and approval workflow. Roster popup edits
are explicit, combined Save shift writes, separate from inline card autosaves and
week publication. Opening, switching tabs or dismissing a clean view never writes.

The header uses server-calculated saved costs and paid time. Unsaved edits label
the saved assessment and replace the header amount with Save to recalculate.
Warnings include the same native subject/staff/general checks as the red icons.
Saved shift publication compares dated shift fields and recorded pay facts with
its published snapshot; other shifts remain Published when only one changes.
Ordinary published readers keep their original snapshot and wage privacy.

Copy and Duplicate review one target day and employee (Duplicate defaults to
Vacant), then use the native revision/CSRF/overlap/availability-checked creator.
They omit recorded facts and written variations. Uncertain creates freeze instead
of offering an unsafe retry. Delete uses native Undo. Publish week is labelled
and confirmed as a whole-week action and retains current award fingerprints and
review notes. Leave opens existing tools and never submits another employee's
request. Opening or using tabs cannot perform any of these actions.

Close, Escape and backdrop share dirty/busy guards, parent navigation is inert
while the overview is open, and context/revision changes reject stale saves.
A desktop editor resized to a phone pauses with draft values retained, hiding
editing controls and financial details; ordinary phone readers gain no new
editor or wage entry points.

### Automatic planned breaks

Native-award locations plan paid rests and unpaid meals on explicit shift creation
and updates. The server stores `breakPlan` with its source version, mode, ISO
intervals, unpaid minutes and readiness issues; it does not create clock events,
agreements or actual-pay deductions. Standard plans cover continuous shifts up to
sixteen elapsed hours, keep meals within 30–60 minutes, paid rests at 10 minutes,
work gaps within five hours and breaks outside first/last hours. Two required paid
rests fall in separate shift halves. Written part-time meals are preserved,
including with an hours-only IFA, unless an explicit recorded variation changes
them. Adjacent cards need a combined-engagement review instead of separate plans.

Breaks in the shift popup defaults to Automatic and debounces read-only native
POST previews. Custom overrides are checked before saving. Changing employee or
work date resets automatic planning; custom plans survive other omitted-field
writers, and copies regenerate for their target. Invalid custom schedules are
rejected atomically. Unsupported automatic plans withhold complete roster costs
and publication. Publication revalidates current agreements, plan edition and
plan/paid-time consistency; a review note cannot waive these checks.

Existing shifts are not migrated on reads. Saved custom meal choices are retained;
legacy shifts show a preview until explicit Save shift. Published snapshots and
approved timesheets are frozen. Native costing uses planned intervals only in
roster mode, counts rests as paid and leaves actual break checks unchanged. The
clock uses the published meal count without claiming any break was taken. Staff
can expand only the published break timetable on desktop and phone schedules;
public team DTOs contain no plan issues, agreements, rates or private work facts.
