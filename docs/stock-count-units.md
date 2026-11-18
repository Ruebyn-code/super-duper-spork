# Counting units

Stock items are ordered, priced and recommended in **ordered units** (the supplier pack). Each item can optionally be counted in something easier to count on the shelf, set in Suppliers & stock → item → Pack & counting → **How to count this item**:

| Count by | Saved `countUnit` | Example |
|---|---|---|
| Ordered units | none | Count boxes |
| Smaller packs | `{name, perUnit}` — any name up to 30 characters, whole number 1–1,000,000 | Sleeves, 20 per box |
| Weight — kg / g | `{name:'kg'\|'g', perUnit, measure:'weight'}` | 2.5 kg per bag, or 2500 g per bag |
| Volume — L / mL | `{name:'L'\|'mL', perUnit, measure:'volume'}` | 2 L per bottle, or 750 mL per bottle |

Weight and volume amounts can have up to three decimals (above 0, up to 1,000,000). The shared `public/stock-count-units.js` validates, normalises and converts every kind the same way: ordered quantity = counted amount ÷ `perUnit`, rounded to three decimals. Stock counts keep both the entered amount (`countedQuantity`) and the conversion they used, so history never changes when the setting does; a count submitted with an out-of-date conversion is rejected, and older counts and drafts keep their original units. Targets, recommendations, usage, transfers, prices and supplier orders stay in ordered units. Wastage can be recorded in the same counting unit.

## Counting whole ordered units and smaller units together

Items with a counting unit show two boxes in Stock count: **Ordered units** on top (whole boxes, bags or bottles still sealed) and the smaller unit underneath (loose sleeves, kg, mL …), with the combined total in ordered units below (for example 2 ordered units + 5 Sleeves at 20 per box = 2.25 ordered units). Either box may be left blank; a blank box counts as zero, and an item counts as counted when either box has a value. Enter/arrow keys move through both boxes in order.

- The count body sends the smaller-unit amount as `quantity` with `countUnit` plus optional `packs` (0–1,000,000, up to three decimals, only allowed with a `countUnit`). Whole ordered units alone are sent as an ordinary ordered-unit count (`quantity`, no `countUnit`).
- The server saves `quantity` = `stockCountUnits.total(packs, quantity, countUnit)` (packs + loose ÷ `perUnit`, rounded to three decimals, at most 1,000,000) and keeps `countedQuantity` (loose) and `countedPacks` (whole units) beside it; `packs` itself is not stored. Saved counts show "2 ordered units + 5 Sleeves" above the total.
- Browser drafts keep both boxes (`packs` beside `quantities`); older drafts and counts without `packs` behave as before. Edit count shows the same two boxes, and a correction re-snapshots an item only when either part changes.
- Usage, target levels, Order when, recommendations, delivery availability and reports keep reading the saved ordered-unit `quantity`.

## Naming the ordered unit

Items may name their ordered unit (`orderUnitName`, optional, single line, ≤30 characters; set in the item editor's Pack & counting → How to count this item → **Name of the ordered unit**, e.g. "Slab", "Box" or "Bag"). Older writers that omit it keep the saved name and `''` clears it. Stock count uses it for the whole-units box label and the total ("= 3 Slab"), and for items counted only in ordered units it labels the count box. Saved counts snapshot it with each item (`orderUnitName`) so history keeps the name in use at the time. It is display only: quantities, conversions, prices and orders are unchanged.

## Sticky group headings

In Stock count entry each area/supplier heading (name, "x of y items counted", Count and Cart columns) sticks to the top of the page while you scroll through that group's items, then gives way to the next group (`position:sticky` with `overflow:clip` on the group). Display only.

## Compact layout

On desktop and tablet (above 600 px) the whole-units and smaller-unit boxes sit side by side (80 px each, 72 px on tablets) in a 168 px Count column (150 px on tablets) with small one-line labels above them. Single-box rows keep a 96 px box aligned to the right. The total line shows only once something is entered. Phones keep the two boxes stacked with tighter spacing. Styling only.
