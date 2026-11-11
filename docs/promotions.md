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

## Cover images, Home and the kiosk

- **Cover image**: Add cover image in the editor accepts JPEG, PNG or WebP. Every cover uses one 16:9 shape so the same photo fits every layout: the browser centre-crops it to 16:9 (up to 1600 × 900, JPEG) before upload, and the Sales card, editor preview, Home card and kiosk slide all use 16:9 frames (the kiosk shows the caption on a company-coloured panel beneath the photo); the server re-checks the file type and a 2 MB limit, stores it privately under `promotions/<companyId>-images/` and keeps one image per promotion. Replacing or removing it uses `PUT`/`DELETE /api/promotions/:id/image` with the promotion's revision and the same edit permissions. Deleting a promotion removes its image.
- **Home**: a Promotions panel on the right of the desktop board (a third column that scrolls on its own, with stacked cards showing the 16:9 cover, name, offer and dates); on tablets and phones it sits above the board as a sideways row (`public/home-promotions.js`) lists running promotions and ones starting within 7 days at the selected location, through `GET /api/home-promotions` (Home viewing). Cards show the cover, name, offer and dates only; notes, authors and sales results are never sent. All promotions links to Sales for people with sales viewing.
- **Kiosk sign-in screen**: a paired, locked kiosk receives the location's running promotions with its staff list and shows them as a rotating carousel (7 seconds, dots to switch) in place of the large logo above Tap to sign in. Images load through paired-only `/api/kiosk/promotions/:id/image`, which only serves promotions that include the device's location and have not finished.
- Images are served `private` with `nosniff`; reading them never writes. When the network's Sales feature is switched off, Home and kiosk promotions disappear and images stop being served.

## Optional features and Promotion settings

Sales → Promotions → **Promotion settings** holds one switch per optional feature, saved company-wide in `promotions/<companyId>-settings.json` (`GET`/`PUT /api/promotions/settings`). Reading needs sales viewing; changing needs sales editing, all-location access, CSRF and the current `revision`. Omitted features are on. Turning a feature off hides its controls and results and stops its effects, but never deletes saved details: editors that send a switched-off field are ignored, and older writers that omit the new fields keep them.

| Switch | What it adds |
| --- | --- |
| **How it went summary** (`results`) | On each started promotion: best and weakest day against the projection, in-store (Weekly report Till) versus delivery (Uber Eats + DoorDash) on days with a complete Weekly report, and **Results by store** for every listed location the viewer can reach. |
| **Expected uplift** (`uplift`) | Optional `expectedUplift` (1–300%). On covered days at a listed location, projections are raised by the largest uplift among the promotions covering that day, after holiday adjustments (`promotions.upliftFor` + `applyUplift`, used by `sales.rosterProjection` and the Sales/Home/Ordering report). This flows into Daily sales projections, ordering budgets, prep amounts per projected sales, roster daily/hourly forecasts and Home. Missing days stay missing and totals/budgets move by the exact cent change. Promotion results always use the normal projection (`promotions:false`). |
| **Promotion products** (`items`) | Up to 50 company catalogue items (`itemIds`, validated against the catalogue and saved with a name snapshot). `GET /api/promotions/items` (orders, counts or sales viewing; names and dates only, no sales figures) feeds `public/promotion-item-flags.js`, which adds an “On promotion” chip under the unit amount on Ordering cards and Stock count rows for promotions on now or starting within 7 days, showing the expected uplift (hover text suggests ordering and prepping about that much extra). Recommendations, carts and counts are unchanged. |
| **Staff awareness** (`staff`) | **Post to Comms** creates an ordinary company post through the normal Comms API and permissions (optional cover image and required reading for people allowed to require it). Promotions on today appear in notifications (`promotions` category) and as a “Promotions on today” line in the checklist reader (`GET /api/promotions/today`, `public/promotions-today.js`). |
| **Leaderboard and reports** (`reporting`) | The Leaderboard tab ranks up to 40 started promotions at the selected location by lift over the normal projection (competition ranks; uncomparable promotions stay unranked; gold/silver/bronze places). Scheduled OpStack intelligence reports with Sales or Performance topics add each location's overlapping promotions' lift as facts. |
| **Repeating promotions** (`repeat`) | Optional `weekdays` (0 = Monday … 6 = Sunday). A repeating promotion covers only those weekdays within its dates and may run for up to 366 days. Results group into **Each repeat** rows, one per week. Daily sales tags, uplift, today and item flags follow the weekdays. |
| **Redemptions** (`redemptions`) | Optional `redemptionCostCents` (a $ off promotion uses its amount when blank). Editors record each covered past day's count at the selected location in Day by day (`PUT /api/promotions/:id/redemptions` with `{date,count,previous}`; the value being replaced must match, repeats are harmless). Results show the count, discount cost, extra sales per redemption and extra sales after discount cost, using only days with sales, a projection and a count. Counts are entered by hand; they are not imported from reports. |

All reads stay read-only and never call providers.
