# Already ordered this ordering week

Stock count rows and Ordering suggestions subtract units already ordered for the current **ordering week** before recommending an order.

- **Ordering week:** Monday–Sunday in Melbourne, using the same rule as order budgets (`order-cost-period.js`): orders placed on Sunday fund the following week, so on Sunday the upcoming week is the ordering week.
- **What counts:** non-deleted orders (live or recorded past orders, with their corrected items) at the selected location and company whose cost week is the current ordering week, matched by item ID. Items whose saved unit amount differs from the current item's unit amount are skipped.
- **Received deliveries:** a supplier's items stop counting once that supplier is marked received in Order history, because the stock is then physically present and belongs in the count. Deliveries that arrived but are not marked received are still counted as ordered, so mark deliveries received to avoid under-ordering.
- **Rule:** `stockOrderRules.recommendation(product, level, counted, ordered)` treats `ordered` as stock: recommended = target level − (count + ordered), rounded by the item's order rule, and the Order when check uses count + ordered. Items with an active delivery plan ignore it, because they already subtract confirmed incoming orders.
- **Where:** the server computes `ordering.alreadyOrdered` and `ordering.orderingWeekStart` in `stock-usage.js` (`orderedThisWeek`), shared by `/api/catalogue` (Ordering) and Stock count. Rows show “Ordered this week: N · not yet received”. The fields are omitted when nothing is outstanding.
- Reads never change orders, receipts, counts or target levels.
