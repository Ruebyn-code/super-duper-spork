# Company logo on printed pages and PDFs

Printed pages and PDFs (the browser's Print / Save as PDF) start with a small header holding the company's own logo, the company name, the store and the print time (Melbourne). `public/print-branding.js` is added to every signed-in page next to the shared Knowledge article popup.

- The logo comes from the company's existing logo routes: the sidebar logo (`/sidebar-logo`), then the main logo (`/logo`) only when there is no sidebar logo, through the company-scoped asset URL. The shared Opstack fallback (`X-Branding-Scope: platform`) is never printed as if it were the company's; a company without its own logo gets the name-only header. It is read once as a data URL (refreshed on `app-logo-updated`) so print windows can show it straight away.
- Printing the page itself (`beforeprint`) puts the header at the top of what is actually printed — the Reporting print area, the open Knowledge centre article or its QR popup, otherwise the page body — and removes it on `afterprint`. Add `no-print-brand` to `<body>` to opt a page out.
- Print windows call `printBranding.brand(doc)` before printing: the printable checklist run and checklist QR station sheets (`public/checklist-extras.js`) and the Staff activity person report (`public/reporting-person.js`).
- Label printing is unaffected (labels print over Bluetooth from their own raster, which already carries the sidebar logo).

## Modern print styling

- The header is a thin accent line in the company primary colour (`--primary`, plain hex/rgb only, slate otherwise), then the logo (≤44 × 170 px) beside the company name and store, with a small uppercase PRINTED label and the Melbourne print time on the right, above a soft divider. It is a plain `div` with inline styles so app `header` rules never reach it.
- `printBranding.styles` is the shared stylesheet for print windows: 16 × 15 mm page margins, a system font at 10.5 pt, a large tight title, labelled fact cards (Location, Date, Completed, Score, Review on checklist runs), tables with small uppercase grey column headings, roomy 10 × 12 px cells, soft row dividers and repeating headers, uppercase section rows, red fail pills, rounded photos and a quiet footer. The checklist run and QR station sheet (a centred card with a Scan pill) use it; the person report and Knowledge article print get the same page margins.
- The Reporting print area (`public/reporting-details.css`) uses the same type, grey meta lines, uppercase column headings, zebra rows and 14 × 13 mm landscape margins. The header always goes into the Reporting print area when one exists, even though it is hidden on screen when `beforeprint` fires.

Display only: nothing is saved, no print is started and no other content changes.
