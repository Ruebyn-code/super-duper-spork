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
terms, source/pay-period coverage or reviewed holiday calendars. Legacy shifts
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
