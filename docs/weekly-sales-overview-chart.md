# Weekly overview sales chart

Sales → Weekly overview shows a **Weekly sales** bar chart above the overview table
for the selected quarter or year to date. It is drawn by `public/weekly-sales-chart.js`
from the same rows the overview already loads, so it adds no reads or writes.

- One bar per week (Monday–Sunday), filled with a vertical gradient of the company
  primary colour only (full primary at the bottom fading to a lighter primary tint at the top), with 4 px rounded tops, a
  recessive grid and a compact dollar axis.
- Part-recorded weeks (1–6 days) are hatched and named in the key; weeks with no
  sales show a dotted baseline marker.
- The dashed line is the period's average of completed weeks (the same figure as the
  table's Average row).
- Hover or keyboard focus shows the week dates, total and recorded-day count; each
  bar links to that week's Weekly report, like the table's week links.
- The table remains the accessible full data view; the chart hides when no week has
  sales. It resizes with the page and follows light/dark theme colours.
