# Target calculations

Choose **Target level system** in **Add location** or the location setup popup.
The choice applies to every current and future stock item at that location.
Change it later in **Edit location → General**, using the existing single
**Save settings** action. Head Office has no stock setup.

In the setup popup, **Target level system** also offers the stock list: enter
manual fallback levels for Usage, or a sales amount and quantity for each item
for Projected sales. Search, partial saves, draft retention and native item writes
remain available. Each sales ratio can also be edited under **Stock items → Edit
item → Ordering rules**. Items show the inherited location system as read-only.
Closing or switching options retains drafts without saving or placing an order.

- **Automatic usage (current)** keeps the existing average from up to four complete
  Sunday–Saturday usage cycles, whole-pack target rounding and manual fallback
  before usable usage exists. Fully configured supplier delivery plans can still
  replace its recommendation with a delivery-coverage quantity.
- **Projected sales** sets a weekly target from an entered sales amount and item
  quantity in ordered units/packs. For $1,000 → 0.5 boxes, a $10,000 projection
  gives 5 boxes. The ratio scales continuously; targets retain three decimal
  places, while recommended/cart orders retain the item's existing whole-unit,
  minimum and rounding rules. This method uses the weekly target even when the
  supplier has delivery timing; delivery dates and receipt history stay intact.

Sales targets use the same original weekly forecast as Ordering, including
weekly-report-first revenue, four complete source weeks, public-holiday and
yearly-growth adjustments, and Sunday's rollover to the upcoming Monday–Sunday
week. They do not use actual sales pace or the updated sales outlook. Missing
forecasts leave the target/recommendation unavailable with a reason; known zero
forecasts give zero. Targets above 1,000,000 ordered units are unavailable.
The automatic **Order when** trigger remains based on completed usage; without
usage, the normal target-minus-count recommendation applies. Stock counts,
counting-unit conversions and confirmed transfer adjustments retain their native
meaning. Reads never create counts, orders, receipts or financial records.

The method belongs to the location; ratios still belong to individual items at
that location. Selecting a method never rewrites ratios, counts, usage or company
stock. Switching back to Usage retains every ratio. Old item writers cannot
override the location system, and old location writers preserve omitted settings.
New stores default to Usage unless Projected sales is selected. Existing locations
without a shared selection retain their legacy item choices until explicitly
choosing a location system.

Sales-selected items without a ratio remain unavailable, with a setup reason.
No usage/manual fallback or guessed coefficient is substituted. The setup task is
ready only when every active item has a saved ratio (including zero), even before
a forecast exists; Usage still requires its native automatic/manual target.
Incomplete partial saves leave the setup highlight in place.

`target-calculations.js` stores private, atomic, revisioned records under
`target-calculations/<location>.json`, with actor/time attribution. Native
`stock.manage` plus `stock.targets`, current company/location access, required
reading and CSRF protect PUT `/api/products/:id/target-calculation`; authority is
rechecked inside the write queue. Exact retries return the current revision,
conflicting edits require reopening, and unrelated items/locations are preserved.
The shared popup retains successful stock/manual/calculation saves across retries;
an uncertain calculation must be checked again even if the user returns to an old
choice. Orders-only viewers receive operational target quantities and week dates,
without ratio settings, underlying sales totals or private audits.

The shared policy is stored in `locations.json` as `targetCalculationMode` and
`targetCalculationRevision`. Creation uses native location creation authority;
explicit method selection also requires target authority. Later changes require
location management plus target authority, CSRF, current location/company access
and required reading, rechecked inside the native queue. PUT
`/api/locations/:id/target-calculation` is the scoped setup writer; ordinary
location settings use their existing writer with the same checks and revision.
Identical retries are accepted, stale conflicting choices are rejected, archived
locations must be restored first and Head Office is exempt.
