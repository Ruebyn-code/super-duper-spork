# Staff activity report

Reporting → Team → **Staff activity** (`/reporting#activity`) shows what people did and when, for the selected locations and period.

## What it shows

Each source appears only when the viewer has its permission in that location's company, and only for records they could already see:

| Source | Events | Needs |
| --- | --- | --- |
| Checklists | Each completed step (latest completion time and person) and each completed checklist. Planner audiences and per-step location/permission limits apply. | `ops.view` |
| Clock in & breaks | Clock in, break start/end and clock out from clock entries at the location. | `rostering.approve` or `rostering.manage` |
| Orders | Live orders placed (placing account resolved by ID) and recorded past orders. Deleted orders are excluded. | `orders.view` |
| Stock counts | Saved counts (counter name matched to the account where possible). | `counts.view` |
| Wastage | Recorded and voided wastage entries. | `wastage.view` |
| Labels | Printed label batches. | `prep.view` |
| Training | Completed training, shown once per person even when they belong to several selected locations. | `learning.view` + `learning.report` |
| Equipment | Problems reported and resolved, and services logged. | `equipment.view` |

Sources without permission are never read and are listed as "Not shown because of your permissions". A failing source is listed separately without hiding the rest. At most the newest 20,000 actions are returned.

## Filters

- **People:** a searchable multi-select of everyone with activity in the period (Everyone by default). Selecting a name in **By person** narrows the timeline to that person.
- **Time of day:** a dropdown with All day, Morning (5–11 am), Midday (11 am–3 pm), Afternoon (3–6 pm), Evening (6–11 pm), Overnight (11 pm–5 am, wrapping past midnight) or a Custom from/to time. Times are Melbourne time; the end time is exclusive.
- **Activity:** a dropdown with a tick box per source (with counts) to turn sources on or off; All activity and Clear reset it.
- The toolbar search also matches people, actions, details and locations.

These filters run in the browser over the loaded timeline, so changing them never reloads or writes anything. Locations and Period reload the report.

## Output

Summary cards (actions, people, busiest hour, most active person), a **By person** table with counts per source and first/last action (its **Columns** dropdown shows any one or more of Actions, each source, First and Last; columns for sources switched off in Activity are left out), and a day-grouped **Timeline**. Export CSV downloads the filtered timeline.

## Rules

`GET /api/reporting/activity` requires `reporting.view` in every selected company, uses the same location selection, kiosk and date-range checks as the training and checklist reports, and is read-only. Code: `reporting-operations.js` (`activity`), store readers `ops-management.activity`, `rostering.clockActivity`, `prep-labels.batchActivity`, and `public/reporting-activity.js`. Tests: `reporting-activity.test.js`.

## By person on every report

Every other report type has a **By person** section above its table (`public/reporting-people.js`). It is built only from the rows already loaded for that report, so it never makes extra reads or writes.

| Report | Person shown |
| --- | --- |
| Business overview, Sales & reconciliation, Expense breakdown | Saved by |
| Cost of goods · details | Requested by |
| Stock transfers | Sent by (outgoing) / received by (incoming) |
| Stored invoices | Uploaded by |
| Stock count detail | Counted by |
| Training progress | Learner |
| Checklist progress | Completed or last worked by (unstarted shows "Not started yet") |

Choosing a person in the dropdown, or clicking their card, filters the table, summary and export to their rows; rows with no recorded person group under "Not recorded". Reports that combine records (supplier totals, usage, bundles, platform fees, daily sales) say they don't record a person and link to the report that does.

A short **Highlights** strip above it calls out the best/largest/top values for the selected rows and how many entries need attention.
