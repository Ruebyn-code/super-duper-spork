# Prep lists

Labels → **Prep list** (`/labels#prep`) is each location's daily prep list.

## Items

Managers (`prep.manage`) open **Manage items** to add, edit or delete the location's prep items. Each item has:

- **Item name** and a fixed **Amount each day** (up to three decimals) with an optional **Unit**.
- An optional **Station** (items are grouped by station on the list).
- **Days** of the week it appears (at least one).
- An optional **Label template** from the company's active Labels templates.
- Optional **Notes** and an **On the prep list** switch to take it off without deleting.

Items belong to one location (`prep-lists/<locationId>/items.json`, `prep-list.js`). Creates use actor-bound `requestId` retries (a reused ID with different details is rejected), edits and deletes are revision-checked, and deleted items are hidden rather than erased so past ticks keep their history. A location can have up to 300 items.

## Ticking off

Anyone with `prep.view` at the location sees the list for a Melbourne date (90 days back to a week ahead; only today can be ticked). Ticking records who and when in `prep-lists/<locationId>/days/<date>.json` with a snapshot of the item; repeating a tick is harmless and changing one needs the current revision. Items ticked and later removed stay on that day's list from the snapshot.

When an item has a label template and the person can print labels (`prep.print`), the row shows **Print labels**, which opens the existing Labels print popup for that template (`/labels?print=<templateId>#print`). Printing still uses the normal Labels batches and permissions.

## Home, kiosk and reporting

- **Home**: a **Today's prep** card at the top of the right-hand column (`public/home-prep.js`, `GET /api/home-prep`, Home viewing plus `prep.view`) shows progress, items still to do first, explicit tick buttons and Labels links for finished linked items. Reading never writes.
- **Kiosk**: staff signed in on a paired kiosk use the same prep list and Home card with their own permissions; ticks record the signed-in person.
- **Staff activity**: Reporting → Team → Staff activity includes a **Prep list** source (“Prepped …” with amount and station), under `prep.view` and `reporting.view`.

Prep lists follow the Labels feature switch, because they use the Labels permissions.

## Amounts per projected sales

An item's **How much to prep** is either **Fixed amount each day** (the original behaviour, stored without a `basis`) or **Amount per projected sales**. Sales-based items are on the list every day, so the editor hides the day choice and the server always stores all seven days (older sales-based items are treated as every day too). They save `basis: 'sales'`, the `amount` per `salesPer` whole dollars ($1–$1,000,000) and an optional `roundTo` step (up to three decimals). Each day's amount is `amount × projected sales ÷ salesPer`, rounded up to `roundTo` (or to 0.001), using that location's normal daily sales projection (the same `dailyProjection`/`sales.rosterProjection` forecast as Daily sales, with its holiday adjustments; past weeks never look ahead). The projection is read only when a sales-based item is on that day's list, and never when the network's Sales feature is off.

A missing projection keeps the amount unknown (staff see **Amount not available** with the reason); a known zero projection means zero. Everyone sees the worked-out amount and a **Based on projected sales** badge; only people with `sales.view` also see the ratio and the projected sales figure, and the API leaves `ratio`, `salesPer`, `roundTo` and `projectedSalesCents` out of rows for everyone else. Managers editing items (`prep.manage`) see the saved ratio. Ticking freezes the amount shown that day into the tick snapshot, so history and Staff activity keep it. Reads never write or change sales, forecasts or budgets.

## Already prepped

Each of today's items has an **Already prepped** field. What staff enter (0–1,000,000, up to three decimals, blank clears it) is saved per item for the Melbourne day in the day file's `onHand` map (`{quantity, revision, at, by, history ≤20}`) through CSRF-protected `POST /api/prep-list/on-hand` `{date, itemId, quantity, revision}` under `prep.view`: today only, repeating the same amount is harmless, changes need the current `onHandRevision` (409 otherwise) and ticked items are locked until unticked. List rows add `onHand`, `onHandRevision`, `onHandBy`/`onHandAt` and `toPrep` = amount − already prepped, never below zero, rounded up to the item's round-up step (or 0.001); unknown amounts stay unknown and no entry means the whole amount. The card's headline amount shows `toPrep` with "x still to make of y" beneath; ticking freezes `onHand` and `toPrep` into the tick snapshot so later item edits don't change a done item. Home's Today's prep card shows the to-prep amount. Typed but unsaved amounts and focus survive list redraws.

## One box per unit

When today's still-to-make amount (`toPrep`) is more than 1 and at most 20, the item splits into one checkbox per unit (`partCount`/`partSizes` in `prep-list.js`; the last box holds any part unit, so 2.5 trays → 1, 1, 0.5). Rows add `parts:[{index,size,done,by,at}]` (every box shows ticked once the item is done). CSRF-protected `POST /api/prep-list/part` `{date, itemId, index, done, revision}` (today only, `prep.view`, the item's `tickRevision`, harmless repeats, 409 for stale revisions or boxes the amount no longer has) records who ticked each box in the day file's `ticks[itemId].parts`; ticking the last box marks the item done with the usual frozen snapshot, and unticking one box of a done item reopens it with the others still ticked. The big checkbox still ticks the whole item; unticking it clears every box. Already prepped is locked while any box is ticked, because it changes the number of boxes. Home's Today's prep card shows boxes ticked (for example 1/3).
