# Uploaded invoices as weekly expenses

The saved **Total** of each invoice, including GST, supplies **Sales → Weekly report → Cost of goods** for that invoice’s selected location and Monday–Sunday bundle. Invoice date and upload date do not override the selected bundle, and a Sunday invoice does not roll forward like a placed order.

- Add saved invoice totals once. Placed-order amounts are reference information and are not added to financial Cost of goods.
- A week with no saved invoices has $0 in invoice expense. An explicit zero invoice is valid.
- An invoice with no total leaves full Cost of goods, expense percentage and profit unavailable. The known subtotal and count of missing totals remain visible; enter the missing total in the invoice to complete the figures.
- Preserve confirmed net cost transfers, Labour, Op Ex and R&O as separate existing costs. Platform fees stay separate from profit.

Weekly report cards, the quarter/YTD Overview, Reporting financial totals, exports, rankings, Home’s weekly financial panel and scheduled intelligence financial reports share this calculation. YTD and other financial periods use whole selected weekly invoice bundles rather than inventing daily allocations.

Saving, correcting, moving or deleting an invoice changes live calculated totals on the next refresh. Reads do not copy invoice amounts into weekly entries, change report revisions or send supplier messages. Open report drafts keep their unsaved sales and other expense fields while invoice costs refresh. Invoice changes notify other open tabs; ordinary refresh/reload also reads current saved invoices.

Invoice details and **Open invoice** links require `invoices.view`. Financial viewers without that permission receive only the aggregate cost and counts. Existing invoice editing, CSRF, file access, revision conflicts, duplicate-file protection and company/location controls remain in place.

Daily sales, forecast revenue, ordering budgets, legacy Home order metrics, stock counts/usage and placed orders retain their existing sources. Invoice price changes still require the existing explicit price confirmation.

Explicitly confirmed stock price changes also update the effective price in the latest order containing each item at every location in that company. History, budgets and placed-order reference costs use those revised totals, while financial Cost of goods still includes saved invoices only. Original order snapshots and sent messages remain available unchanged; confirmation never resends them. See [Order history](order-history.md).
