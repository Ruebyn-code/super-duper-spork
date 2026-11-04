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

## Week numbers

`public/sales-week-model.js` numbers each Monday–Sunday week by the quarter and year
containing its Sunday (the overview's existing rule), so week 1 is the week ending on
the first Sunday of the period; quarters have 12–14 weeks and years 52 or 53.

- Daily sales and the Weekly report show a "Week 6 of Q4 · Week 45 of 2026" tag beside
  the selected week's dates (on phones the Weekly report keeps its dates hidden and
  shows only the tag).
- The Weekly overview table shows a "Wk" chip per row (week of quarter in Quarter view,
  week of year in Year to date), and the chart adds W-numbers above its date labels
  and both week numbers in each tooltip.
