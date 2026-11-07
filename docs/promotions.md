# Sales promotions

Sales → **Promotions** (`/sales#promotions`) records the deals a store runs and shows how sales went on those days.

## What a promotion holds

- **Name**, **Type** (% off, $ off, Special price, Bundle or meal deal, Buy one get one, Free item, Other) and, for the first three, the discount or price.
- **Sales channels**: In store, Online ordering, Uber Eats, DoorDash (at least one).
- **Starts** and **Ends** (Melbourne dates, up to 92 days).
- **Locations** running it, chosen from active locations in the current company that the editor can access.
- Optional **Notes** (up to 500 characters).

Promotions are stored per company in `promotions/<companyId>.json` (`promotions.js`), with shared types, channels and wording in `public/promotions-model.js`.

## Permissions

- Viewing needs the existing **sales viewing** permission and shows promotions that include the selected location.
- Adding needs **sales editing** plus CSRF. Editing or deleting also needs access to every location the promotion lists; otherwise it is shown read-only.
- Creates use an actor-bound `requestId` so retries save once (a reused ID with different details is rejected). Edits and deletes are revision-checked; deletes keep a hidden record so repeating one is harmless.

## Results

`GET /api/promotions/:id/performance` compares, for the selected location, each promotion day up to today:

- **Sales** use the same weekly-report-first daily revenue as projections (complete Weekly report Till + Uber Eats + DoorDash, otherwise Daily sales).
- **Normal projection** is that day's `dailyProjection` from `sales.rosterProjection` (historical weeks never look ahead).
- Totals, the dollar difference and percentage only include days with both a saved sale and a projection; missing days stay out and the card says how many days were compared.

During long promotions, later weeks' projections include earlier promotion days in their four-week history, so the comparison is a guide rather than a controlled test.

Reading results never writes, never changes saved sales, forecasts, ordering budgets or rosters, and never calls providers.

## Daily sales tags

`public/promotion-markers.js` adds a small tag beside each Daily sales date covered by a promotion, reading `GET /api/promotions?from=&to=` once per week and location. Tags link to Promotions and refresh after a promotion is saved.
