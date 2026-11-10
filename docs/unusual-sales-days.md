# Unusual sales days

Sales projections (Daily sales, ordering budgets, rosters, hourly forecasts, delivery planning and sales-based prep amounts) average the same weekday over the four latest completed weeks. One unusual day — a big event or a storm — would otherwise push that weekday's projection up or down for four weeks.

## The rule (`projection-exclusions.js`)

- A completed day is **unusual** when its saved revenue (weekly-report-first, the same source projections use) is more than the company limit **above or below usual**. *Usual* is the average of the four previous same weekdays that were not public holidays, found within eight weeks; without four of those with saved sales the day is never judged.
- Unusual days are left out of projections exactly like public holidays: `holiday-projections.normalForecast` replaces them with the next older normal same weekday (searching up to 52 weeks), shares those source dates with hourly profiles (`normalSourceDates`), lists the replaced dates per weekday in `unusualDates`, and marks the projection `unusualDayExclusion` with the `unusualPercent` used.
- **New normal:** if two or more of the four most recent normal same weekdays before the projected week moved the same way (both high or both low), they are all kept, so lasting growth or decline still shows up.
- Saved sales, Weekly reports, totals, profit and reports are never changed. Reads never write.

## Company setting

Sales → Projection & budget → **Unusual days** sets the limit per company (`projection-settings/<companyId>.json`, whole numbers 10–100, default 30). `GET /api/sales/projection-settings` needs `sales.view`; `PUT` needs `sales.edit`, access to every location (`locations.all`), CSRF and the current `revision` (stale saves get 409). Changing it applies to every location's projections straight away.

## Daily sales markers

`GET /api/sales` returns `projectionDays` for the shown week: each completed day with saved sales is `used` or `left-out` (with `reason` `high`/`low`/`holiday`, `changePercent` and `usualCents`), judged as the projection for the following week would. Left-out high/low days show a **Not used in projections · N% above/below usual** chip under the date; its tooltip gives the usual amount.
