# Uploaded invoices as weekly expenses

The saved **Total** of each invoice, including GST, supplies **Sales → Weekly report → Cost of goods** for that invoice’s selected location and Monday–Sunday bundle. Invoice date and upload date do not override the selected bundle, and a Sunday invoice does not roll forward like a placed order.

- Add saved invoice totals once. Placed-order amounts are reference information and are not added to financial Cost of goods.
- A week with no saved invoices has $0 in invoice expense. An explicit zero invoice is valid.
- An invoice with no total leaves full Cost of goods, expense percentage and profit unavailable. The known subtotal and count of missing totals remain visible; enter the missing total in the invoice to complete the figures.
- Preserve confirmed net cost transfers, Labour, Op Ex and R&O as separate existing costs. Platform fees stay separate from profit.

Weekly report cards, the quarter/YTD Overview, Reporting financial totals, exports, rankings, Home’s weekly financial panel and scheduled intelligence financial reports share this calculation. YTD and other financial periods use whole selected weekly invoice bundles rather than inventing daily allocations.

Saving, correcting, moving or deleting an invoice changes live calculated totals on the next refresh. Reads do not copy invoice amounts into weekly entries, change report revisions or send supplier messages. Open report drafts keep their unsaved sales and other expense fields while invoice costs refresh. Invoice changes notify other open tabs; ordinary refresh/reload also reads current saved invoices.

In the scanner’s **Invoice details**, **Choose supplier** offers a searchable list
of saved suppliers for the selected company. Choosing one replaces the editable
supplier name and refreshes the ordinary price comparison. The scanned name
remains available for manual correction, including suppliers outside the list.
Nothing saves or changes stock prices until the normal confirmation. The list
is read-only, requires invoice viewing and editing, and returns only supplier
IDs/names without granting catalogue or supplier-management access. A failed
list request leaves manual entry available, with an explicit retry. Late
responses never overwrite a typed name or an unrelated invoice/context.

Invoice details and **Open invoice** links require `invoices.view`. Financial viewers without that permission receive only the aggregate cost and counts. Existing invoice editing, CSRF, file access, revision conflicts, duplicate-file protection and company/location controls remain in place.

**Invoice scanner → Weekly bundles → Download bundle** downloads one ZIP of all
original invoice images and PDFs saved in the expanded week. It uses the selected
location and bundle week, rather than printed invoice dates. Original bytes are
preserved; each safe filename includes its saved supplier name and original upload
name, with a number keeping repeated names separate (for example
`0001-Oroso Poultry-invoice.pdf`). Missing supplier names use `Unknown supplier`;
long names are shortened to fit safely. Corrected saved supplier names are used
on the next download without renaming stored files. Readers
with `invoices.view` can download without invoice-editing or stock permissions.

The server pins the saved originals briefly under the location's existing queue,
then streams the ZIP without holding invoice writes or buffering the whole week.
Moves/deletions after that snapshot do not truncate it. All file handles close on
completion, error or cancellation. Missing/damaged originals fail the download
instead of silently omitting a file. Context changes cancel the browser request;
the endpoint also checks the requested location. Downloads are private, uncached
reads and never modify invoices, expenses, prices or orders or contact providers.

Daily sales, forecast revenue, ordering budgets, legacy Home order metrics, stock counts/usage and placed orders retain their existing sources. Invoice price changes still require the existing explicit price confirmation.

Explicitly confirmed stock price changes also update the effective price in the latest order containing each item at every location in that company. History, budgets and placed-order reference costs use those revised totals, while financial Cost of goods still includes saved invoices only. Original order snapshots and sent messages remain available unchanged; confirmation never resends them. See [Order history](order-history.md).
