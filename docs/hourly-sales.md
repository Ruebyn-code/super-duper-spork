# Hourly sales

Open **Sales → Hourly sales** or choose **View hourly sales projections** in Projection & budget. Select a Melbourne trading date to compare projected and reported sales by clock hour. Uploading hourly reports does not change Daily sales, Weekly report, order budgets, roster schedules or financial totals.

Home's bottom-right **Quick actions** menu has **Scan hourly sales** at any time for Store Manager Home users with hourly import and sales viewing (never Staff or Head Office Home); it opens the same uploader, including **Take photo**, without a pinned date, and a save refreshes the Home Daily sales panel. The **Daily sales** reminder on Manager Home also offers **Scan hourly sales report** while that trading day’s entry is available. It opens the same OpStack intelligence uploader directly on Home, with the location and trading date pinned as context. CSV/Excel, PDF and photos follow the same review and explicit **Submit hourly sales** process below. A save confirms the imported dates and offers **View hourly sales**; the Home hourly forecasts refresh. Scanning does not fill or save the Daily sales total, and an unsaved daily amount stays intact. The action requires Home and sales editing access, stays hidden on Staff Home and does not change access to Sales elsewhere.

Choose **OpStack intelligence · Upload report**. Sales viewing and editing permissions are required to import; viewers can read saved hours and forecasts. Company intelligence must already be enabled with a saved OpenAI key, budget and request allowance.

1. Choose a CSV/XLSX export (up to 5 MB), PDF, JPEG, PNG or WebP photo/screenshot. Or press **Take photo** to photograph the printed report with the device camera (the shared in-app camera in `public/camera-capture.js`, falling back to the phone's camera on devices without in-app camera support); the JPEG is prepared exactly like a chosen photo file, nothing is uploaded until **Read report**, and **Retake photo** or choosing a file replaces it. The button appears in both Sales → Hourly sales and the Home Daily sales scanner when a camera is available. Reports support up to 31 dated days per read. For a PDF, choose up to three page numbers from 1–20. Longer reports can be imported in groups.
2. Review the visible source text and selected page thumbnails. CSV/XLSX preparation reads saved cell values without evaluating formulas, macros, links or embeds. Recalculate and save missing formula results in Excel first. PDF/photo preparation happens locally. Only **Read report** sends the visible source and included selected images to OpenAI; it uses the existing company budget and request ledger. Source preparation, browsing and forecasting are free.
3. Check the extracted report location, dates, hourly amounts and report totals. Expand each date to correct values. The extractor uses explicit hourly sales totals, rather than distributing day totals, adding ambiguous channels, or interpreting transaction/half-hour exports. Unreadable hours remain blank. Review warnings against the original.
4. If the scan cannot tell how dates are grouped, choose the required **Report dates are** option; no second scan is needed. Choose **Trading day** when each report date already includes that night’s after-midnight sales. Choose **Calendar day** for midnight-to-midnight exports; all seven saved trading-hour entries are required for conversion. Early-morning hours belonging to the previous overnight period retain its opening date and week. Partial first/last trading days can remain incomplete until the adjoining calendar day is uploaded.
5. Mark **These are full-day reports; unlisted hours mean $0** only when the reports cover every sales hour. Otherwise, blanks remain unrecorded and the day is not a complete hourly profile. A full-day report must reconcile to its explicit report total when one was extracted. Explicit zeros are always preserved.
6. Press **Submit hourly sales** in the fixed popup footer. It appears as soon as scanning finishes and stays available while you check or correct the extracted hours. This one action validates and saves the report; no separate review/import button is required. By default it fills missing hours and skips an entire trading date if existing amounts differ. **Replace differing saved hours** explicitly allows correcting the submitted hours; unsubmitted saved hours remain intact. Errors keep your scanned hours open for correction and another submit. Retries preserve the same import reference after an uncertain save, preventing duplicate writes. Messages remain visible beside Submit. After saving, the page opens the earliest imported trading date and displays its reported hours. Submitting hours that already match saved values opens those existing hours without another write.

Scanning and editing the extracted hours do not save sales; only Submit hourly sales does. The upload popup blocks context switching while open; Cancel closes it without importing. Other Daily sales and Weekly report drafts are preserved. The original report binary is not archived; only reviewed hourly values and bounded import metadata are saved. Re-upload the original to review a correction later.

## Forecasting

The daily forecast total is calculated by the existing shared daily forecast: Weekly report Till sales + Uber Eats + DoorDash take priority when all channels are recorded; otherwise Daily sales is used. Normal days require the same four completed Monday–Sunday weeks. Historical forecast dates use only weeks completed before their target week.

For a normal day, complete hourly profiles for the same weekday in those four weeks define the hourly distribution. Their amounts are combined by clock hour and divided by their combined total. The existing daily forecast is allocated with these proportions, reconciling rounding in cents so the 24 projected hours add up exactly to that daily forecast.

For a public holiday with a valid prior-year named match and complete growth history, the daily total already includes the existing growth adjustment since the previous holiday. A complete hourly profile for that prior holiday supplies the distribution. For example, last year’s holiday at $2,000 with $800/$1,200 across two hours becomes $960/$1,440 when the shared daily forecast grows 20% to $2,400. If the prior holiday’s hourly profile is missing, the normal four-week hourly pattern may be used for that same adjusted daily total, with an explicit explanation. The app does not invent a holiday profile or a growth rate.

Missing/incomplete hourly profiles leave the hourly projection unavailable; they do not become zero. A zero daily forecast with complete zero profiles remains a real zero. A positive forecast cannot be allocated from an all-zero pattern. Forecasts are deterministic server calculations; intelligence reads the reports, rather than inventing projected amounts.

## Rosters

Rostering shows hourly projected sales directly beneath each time label in **Day
view**, for users with the existing roster sales/budget summary access. Staff,
Stacked and phone roster views do not show hourly sales, and there is no separate
forecast panel or chart above the board. Home and Sales → Hourly sales retain
their own existing displays.

The amounts reuse the same server-derived hourly forecasts, exact daily allocation,
weekly-report priority, historical cutoff and holiday/yearly growth adjustment.
The Day staff timeline describes calendar hours, so after-midnight values follow
the importer's existing rule: if the previous trading day closed after midnight,
its hours before closing belong under the following calendar day's early hours.
Closed previous days and a midnight closing do not carry hours forward; a 24-hour
09:00–09:00 trading day carries hours before 09:00. Missing previous trading hours,
hourly history or an out-of-week prior trading date show a dash with a reason,
never guessed zeroes or a different day's sales. Explicit zeroes show $0.00.
Hover titles identify the hourly interval, original trading date when different,
and missing-history/fallback reasons. No extra history is fetched or recalculated
for header display. Switching dates or views never saves shifts, publishes,
imports reports or calls intelligence; native draft guards and phone salary
privacy remain unchanged.

Hourly times display in 12-hour format with AM/PM in the chart, table and scanned-hour editor. Printed ranges are read as interval totals: **11:01–12:00 → 11:00 AM–12:00 PM**, **12:01 PM–1:00 PM → 12:00 PM–1:00 PM**, and **11:01 PM–12:00 AM → 11:00 PM–12:00 AM**. The app maps copied source labels deterministically; it never moves an amount to the range’s ending hour. Unsupported half-hour, multi-hour or ambiguous ranges are omitted with a warning, rather than combined or split. Conflicting duplicate rows leave the hour unrecorded; matching duplicates count once. Internal clock-hour buckets remain 00:00–23:00. Overnight display keeps after-midnight hours with their opening trading date and marks them **+1 day**. A daylight-saving repeated clock hour belongs to the same bucket; review the export’s combined hourly amount. This is a sales distribution, not a timestamped transaction or payroll ledger. Location and company access is enforced on every read and import, and payroll/calendar review records and provider keys never appear in hourly responses.

Normal weekday forecasts exclude public holidays from the four completed source
weeks. Each affected weekday uses its latest four distinct non-holiday dates,
looking back at most 52 completed weeks. Missing selected sales remain unknown;
zero remains recorded. Weekly-report-first source selection is unchanged, and
saved actuals/history are never rewritten. Hourly profiles use these same source
dates. The prior-year matching-holiday method remains in place, but its growth
comparison excludes pairs where either date is a public holiday. No surcharge is
added, removed or inferred from saved revenue.

## Reading difficult reports

- **Photos:** before anything is sent, the browser converts a photo to greyscale and stretches its contrast (1–99% levels), which makes faint thermal print darker and the paper whiter. A tall receipt (more than about 1.6 times taller than wide) is sent as up to three overlapping top-to-bottom slices at full resolution instead of one shrunken image; the instructions tell OpStack intelligence to treat the slices as one report and list rows repeated in the overlap once, and identical repeated days collapse on the server.
- **Columns:** the hourly amount column may be called Sales, Total, Net sales, Gross sales, Amount, Revenue, Takings or $. When a report has both GST-inclusive and GST-exclusive amounts, the GST-inclusive one is used and named in a warning. Count columns (transactions, customers, items) are ignored.
- **Part-hour rows:** 30- and 15-minute rows are copied as printed and added into their hour on the server only when the printed ranges cover the whole hour exactly once (e.g. 11:00–11:30 + 11:30–12:00). A partial set, or repeats with different amounts, leaves that hour unrecorded with a warning.
- **Time formats:** besides 11:00, 11 AM and ranges such as 11:01–12, the server also reads 11.00am, 1100–1200 and 11h.
- **No printed date:** the read request includes `fallbackDate` (the date being viewed on Hourly sales, or today in Melbourne from Home). OpStack intelligence uses it only when the report prints no date, and adds a warning; the date can be checked before Submit.
- **Partly unreadable reports:** a day without a readable date, an unreadable row or amount, or a day with no readable amounts is skipped with a warning; the rest of the read is kept. Only a read with nothing usable fails, with advice to use a clearer photo or a closer crop.
