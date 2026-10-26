# Supplier delivery planning

Open **Edit location → Supplier delivery days**. Set regular weekdays, then open
**Delivery timing & exceptions** for a supplier. The location popup's existing
**Save settings** saves all changed sections together.

- **Lead time** is a whole number of calendar days, from 0 to 30.
- **Order cutoff** is the last local time to order that many days before delivery.
- **Delivery time** is the supplier's expected arrival time. Enter AM/PM or 24-hour
  text; the editor displays 12-hour time. Same-day cutoffs must precede arrival.
- **Skip public holidays** uses the location's state calendar, with reviewed
  calendars taking priority. Set the location state or review a calendar first.
- **One-off changes** either skip a dated delivery or add an extra delivery date.
  These take priority over regular weekdays and holiday skips.

Timing follows the location state's capital-city Australian timezone; an unset
state uses Melbourne time. Repeated daylight-saving times use the later instant;
skipped times move to the first valid minute after the gap. The next delivery is
the first future delivery whose cutoff has not passed. The app searches up to
180 days ahead and shows when a cutoff was missed or no delivery is available.
Blank timing fields stay unknown, with regular dates shown as estimates. They do
not activate delivery-based targets or invent a supplier's acceptance deadline.

Ordering's selected supplier, cart groups and the final order review show estimated
delivery dates and deadlines. These are planning estimates, not a delivery booking
or a restriction on placing an order. Cart review refreshes estimates before and
after approval and retains quantities and notes.

## Recommendations and shortages

For a fully configured schedule with both a next and following delivery, the
delivery target covers expected use from now until the following arrival. It uses
the same item consumption average from up to four completed Sunday–Saturday usage
cycles as Target level. Complete sales forecasts distribute that usage by weekday
and include existing public-holiday/yearly-growth adjustments. Missing sales
history falls back to the item's average weekly use spread across days. Missing
item usage retains existing manual/weekly recommendations; recorded zero use is zero.

Available stock is an estimate from the latest saved count, confirmed transfer
adjustments, estimated usage since that count and received stock after it. Counts
older than 28 days need a fresh count. Depleted stock is clamped to zero before
later receipts are added. Confirmed incoming quantities arriving within the coverage
window are deducted from the suggested order. An arrival at the following delivery
starts the next coverage period and does not reduce stock needed before then.
Unknown or overdue deliveries are
flagged for review instead of being treated as available stock. Incompatible pack
snapshots are excluded. Existing whole-unit, minimum and rounding rules still apply.

Catalogue and Stock count share the same delivery coverage calculation. Stock count
uses the physical quantity being entered, including sleeve-to-ordered-unit conversion.
Shortage checkpoints flag likely depletion before the next arrival, even when an
order is already on its way. Recheck count drafts after stock has arrived. These
calculations do not alter weekly usage history, saved targets/counts, financial
expenses or the current cart. Orders-only viewers receive operational quantities
and dates, never underlying sales amounts or private financial reports.

## Orders and receipts

New live orders freeze their delivery estimates when saved. Accepted supplier
submission counts as an outstanding order; it does not mean goods have arrived.
Unconfirmed, failed, platform-handoff or unconfigured sending needs **Confirm
ordered** after staff have actually placed the order externally. Set its expected
delivery date so planning can account for it. Provider sending states remain as
recorded and these actions never send another supplier email.

Open **Order history → View order → Delivery tracking**:

- **Confirm ordered** records that an outstanding supplier order has been placed.
- **Change delivery date** updates that supplier's outstanding estimate.
- **Mark received → Confirm received** confirms the full supplier delivery.

Different suppliers in one order can be received separately. Received deliveries
cannot be rescheduled. Original order/count files, UUIDs, quantities, timestamps,
request fingerprints, sending results, prices and financial totals remain intact.
Deleting an order excludes its delivery effects with the rest of its order data.

Receipts after a saved count enter the available-stock estimate once. A later
physical count already includes received stock, so it prevents a second credit.
Historical orders start untracked: recording an old receipt only updates history.
Explicitly confirming an outstanding future-dated historical order enables stock
planning. Changing supplier settings does not silently retarget placed orders;
correct those dates explicitly in Order history after confirming with the supplier.

Location management permission and CSRF protect schedule edits. Order viewing plus
placing permissions, current location/company access and CSRF protect receipt
actions. Private, atomic records in **data/order-receipts/** retain revisions,
request IDs and actor attribution; identical retries apply once and conflicting
edits require reloading. An uncertain browser response retains its request for
explicit retry and locks unrelated dialog actions until resolved. Browsing,
polling and forecasts never receive stock or create/send orders.

A new order still being sent must finish its initial sending step before receipt
changes. If a process stopped and an old pending send remains unresolved, explicit
receipt actions become available after two minutes. They record staff's delivery
confirmation separately and never retry or alter the uncertain sending operation.
