# Ordering data

Home's ordering widget, Ordering and Cart share the read-only forecast and cost
summary in `public/sales-budget.js`. Projected COGS % is the displayed ordering
week's allocated saved-order costs, including net confirmed cost transfers, plus
the current cart where available, divided by expected full-week sales for that same week.
It refreshes with the existing cart, sales, price and budget events.

The COGS sales outlook combines recorded sales through today with forecasts for
all unrecorded days. It resolves one revenue source per day: complete Weekly
report Till + Uber Eats + DoorDash, otherwise Daily sales. It never adds both.
Compare those actuals with the holiday-adjusted forecast for the same recorded
weekdays, then multiply unrecorded-day forecasts by that sales pace. For example,
20% ahead means a 20% increase for the unrecorded days. Missing past days remain
estimates, future-entered amounts are ignored and explicit zero sales count.
Partial hourly reports do not represent completed daily totals.

Expected sales and sales pace appear under Projected COGS on Home, Ordering and
Cart. The COGS number is green at or below the displayed budget percentage and
red above it, using unrounded amounts; unavailable COGS stays neutral. The
original forecast, 28% ordering allowance and its budget-used bar retain their
existing planning basis. This is an updated sales outlook for COGS only.

Without comparable positive forecast sales, retain the normal remaining-day
forecast and explain the baseline. Missing forecast days leave the outlook
unknown; a fully recorded week uses its actual total without needing history.
The server rounds the remaining forecast once to cents using the unrounded
sales ratio and refuses unsupported totals. On Sunday, the ordering week moves
forward: apply the current week’s recorded sales pace to the upcoming week’s
forecast, with no current-week actual revenue added to that future week. Monday
starts a new current-week comparison. Source records and Daily sales performance
remain unchanged. Only revenue aggregates enter the API; finance details stay
under their existing permissions.

Ordering puts **Available after cart** first, beside the forecast, 28% budget,
allocated order costs and projected COGS. The budget-used bar includes the current
cart and shows the exact percentage even above 100%; only its visual fill is
bounded. At 90% it shows **Near budget**, and any negative remainder shows
**Over budget**. Net transfer credits remain part of the calculation. Pending
prices or missing sales keep the remainder and usage unknown; a known $0 budget
is shown separately. **Review cart** opens the existing cart without placing an
order. Failed refreshes clear old figures and offer **Retry budget**. The compact
page heading keeps the original appearance identities without a resizable hero.

Use `orderingProjection.salesOutlook.expectedSalesCents` after holiday adjustments, retaining the
existing fallback to `projection`. At Melbourne Sunday midnight the ordering
week moves to next Monday–Sunday, together with its allocated costs. Keep the
location/company permissions, price adjustments and deleted-order exclusions
owned by the existing sales API. Clients without an outlook retain the baseline
denominator for compatibility; an explicitly unavailable outlook stays unknown.

Show one decimal place, with zero when all costs are known and zero. Show a dash
for missing or zero expected sales, incomplete prices or invalid totals. Preserve
net transfer credits and unrounded cart subtotals until presentation. This is an
order-based planning estimate. Weekly financial COGS continues to use saved
invoices; this display never rewrites invoices, orders, sales or budgets.

The metric uses ordinary layout identities and `data-user-text` for its computed
value. Keep it hidden with the existing budget on Staff Home and for viewers
without `sales.view`. Check desktop/phone layouts and native cart changes, price
refreshes, Sunday rollover and the no-data/pending-price cases.
