# Ordering data

Home's ordering widget, Ordering and Cart share the read-only forecast and cost
summary in `public/sales-budget.js`. Projected COGS shows two estimates together:
**Original projection** divides the displayed ordering week's allocated saved-order
costs, including net confirmed cost transfers and the available current cart, by
the original holiday-adjusted projected sales. **Updated projection** divides
the same costs by the expected full-week sales outlook for that same week.
It refreshes with the existing cart, sales, price and budget events.

The updated sales outlook is the original weekly forecast plus the current dollar
variance: saved actual sales minus the forecast for those same recorded days.
For a $7,000 forecast, $2,400 actual against $2,000 expected so far gives a $400
positive variance and a $7,400 updated projection. $1,600 actual gives $6,600.
Unrecorded days keep their original forecasts, including missing past days. The
remaining days are never multiplied by a sales-growth percentage.

Resolve one revenue source per recorded day through today: complete Weekly
report Till + Uber Eats + DoorDash, otherwise Daily sales. Never add both.
Future-entered amounts and partial hourly reports are excluded; explicit zero
sales are valid. Zero forecast sales on a recorded day still permit a dollar
comparison. Whole-week cent rounding is retained in the remaining forecast.

Both estimates appear side by side on Home, Ordering and Cart, with their sales
denominators below. Updated projection also shows the dollar amount above or
below projection, or On projection. Each COGS number is independently green at
or below the budget percentage and red above it, using unrounded amounts.
Unavailable estimates stay neutral. The original forecast, 28% allowance and
budget-used bar retain their existing planning basis.

Without recorded sales for the displayed week, keep its original forecast.
Missing forecasts leave the updated outlook unknown; a fully recorded week can
use its actual total without history. Refuse unsupported totals. On Sunday the
ordering week moves forward: the upcoming week starts from its own original
forecast, without applying the previous week’s dollar variance. Source sales,
Daily sales performance and financial reports remain unchanged. Only revenue
aggregates enter the API under the existing sales permissions.

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
