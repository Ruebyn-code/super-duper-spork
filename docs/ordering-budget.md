# Ordering data

Home's ordering widget, Ordering and Cart share the read-only forecast and cost
summary in `public/sales-budget.js`. Projected COGS % is the displayed ordering
week's allocated saved-order costs, including net confirmed cost transfers, plus
the current cart where available, divided by projected sales for that same week.
It refreshes with the existing cart, sales, price and budget events.

Use the final `orderingProjection` after holiday adjustments, retaining the
existing fallback to `projection`. At Melbourne Sunday midnight the ordering
week moves to next Monday–Sunday, together with its allocated costs. Keep the
location/company permissions, price adjustments and deleted-order exclusions
owned by the existing sales API. No additional financial records are read.

Show one decimal place, with zero when all costs are known and zero. Show a dash
for missing or zero projected sales, incomplete prices or invalid totals. Preserve
net transfer credits and unrounded cart subtotals until presentation. This is an
order-based planning estimate. Weekly financial COGS continues to use saved
invoices; this display never rewrites invoices, orders, sales or budgets.

The metric uses ordinary layout identities and `data-user-text` for its computed
value. Keep it hidden with the existing budget on Staff Home and for viewers
without `sales.view`. Check desktop/phone layouts and native cart changes, price
refreshes, Sunday rollover and the no-data/pending-price cases.
