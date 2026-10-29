# Visible roster costs

The desktop/tablet roster maker shows an authorised shift’s saved cost directly
on its card, with the employee’s whole-week total beside their name in Staff
view. Stacked view retains per-card and per-day costs. Day timeline bars label
the whole shift cost, including a continuing overnight shift; these are not
additional daily expense allocations.

The amounts use existing server-calculated native award costs, or existing
dated legacy hourly rates when that company uses flat-rate costing. This
display adds no rates, changes no award settings and never guesses missing
amounts. Unknown costs stay unknown; an actual zero is displayed as $0.00.
Staff with no shifts have a $0.00 planning total. A total with any unpriced
shift is unavailable rather than a misleading sum of only the priced shifts.

Click a shift cost to open native Pay details. Blocking reasons are visible
there when the calculator cannot price the work, including missing employment
terms, source/pay-period coverage or reviewed holiday calendars. Legacy shifts
without a rate show a read-only explanation and the existing award-settings
destination when authorised. Merely opening details never saves or publishes.

Edits show Updating cost until the native serial save and recalculation finish.
Staff totals update alongside saved shift costs without replacing active input
fields. Failed or uncertain saves keep their existing draft/error/undo handling.

Wage visibility follows existing server DTOs and roster permissions. Ordinary
staff do not receive new cost fields. The phone published-team reader retains
its existing private schedule-only data, without attaching draft shift prices
to published shifts. Financial expense reports, approved wage snapshots,
budgets, pay rules, native validation and employer-wide costing are unchanged.
