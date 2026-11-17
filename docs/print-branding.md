# Company logo on printed pages and PDFs

Printed pages and PDFs (the browser's Print / Save as PDF) start with a small header holding the company's own logo, the company name, the store and the print time (Melbourne). `public/print-branding.js` is added to every signed-in page next to the shared Knowledge article popup.

- The logo comes from the company's existing logo routes: the main logo (`/logo`), then the sidebar logo (`/sidebar-logo`), through the company-scoped asset URL. The shared Opstack fallback (`X-Branding-Scope: platform`) is never printed as if it were the company's; a company without its own logo gets the name-only header. It is read once as a data URL (refreshed on `app-logo-updated`) so print windows can show it straight away.
- Printing the page itself (`beforeprint`) puts the header at the top of what is actually printed — the Reporting print area, the open Knowledge centre article or its QR popup, otherwise the page body — and removes it on `afterprint`. Add `no-print-brand` to `<body>` to opt a page out.
- Print windows call `printBranding.brand(doc)` before printing: the printable checklist run and checklist QR station sheets (`public/checklist-extras.js`) and the Staff activity person report (`public/reporting-person.js`).
- Label printing is unaffected (labels print over Bluetooth from their own raster, which already carries the sidebar logo).

Display only: nothing is saved, no print is started and no other content changes.
