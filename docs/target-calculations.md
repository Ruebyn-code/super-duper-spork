# Target calculations

In **Ordering → Stock items**, edit an item, open **Ordering rules**, then choose
**Target calculation** for the selected location. The existing **Save changes**
button saves it with the other popup changes. Closing retains a draft; switching
methods or editing the ratio never writes or places an order.

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

The method and ratio belong to each location and item, separately from company
stock details and legacy manual levels. Switching to usage restores that method
and retains the saved ratio for later. Old stock/manual-target writers never
reset a selection. New locations retain usage by default. A configured sales
calculation satisfies the location setup's target-setting task without inventing
a forecast; its manual-entry row stays read-only.

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
