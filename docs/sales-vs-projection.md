# Sales versus projection badges

Sales → Daily sales and Sales → Weekly report show a small badge beside each
recorded day's total:

- **▲ green**: above that day's projected sales, with the dollar and percentage
  difference (for example `▲ $356.22 · 35.6%`).
- **▼ red**: below projection, in the same format.
- **● grey**: exactly on projection.

The weekly total (Weekly report **Totals** column and Daily sales **Recorded
weekly sales**) shows the same badge, comparing the recorded days with the sum of
those same days' projections. Part-recorded weeks say how many days are included
in the hover text; if any recorded day has no projection, the week badge is hidden.

The arrow is always kept beside the dollar amount; in narrow columns only the
percentage wraps to a second line.

Days without a recorded total, or without a known projection, show no badge.
A zero projection shows only the dollar difference. Badges update live while
typing and use the existing success/danger theme colours in light and dark mode.

## Data

`GET /api/sales` and `GET /api/weekly-sales-reports` add
`dailyProjection: {weekStart, days: [cents | null × 7]}` for the selected week.
It reuses `sales.rosterProjection`, the same weekly-report-first forecast with
public-holiday adjustments that rosters use. Historical weeks only use the four
completed weeks before them, so past weeks compare with what was forecast at the
time. Only revenue aggregates are returned, under each page's existing
permissions; reads never write. The comparison is `public/sales-vs-projection.js`.

The Weekly report day total only appears once Till sales, Uber Eats and DoorDash
are entered (existing rule), so its badge appears at the same point.
