# Counting units

Stock items are ordered, priced and recommended in **ordered units** (the supplier pack). Each item can optionally be counted in something easier to count on the shelf, set in Suppliers & stock → item → Pack & counting → **How to count this item**:

| Count by | Saved `countUnit` | Example |
|---|---|---|
| Ordered units | none | Count boxes |
| Smaller packs | `{name, perUnit}` — any name up to 30 characters, whole number 1–1,000,000 | Sleeves, 20 per box |
| Weight — kg / g | `{name:'kg'\|'g', perUnit, measure:'weight'}` | 2.5 kg per bag, or 2500 g per bag |
| Volume — L / mL | `{name:'L'\|'mL', perUnit, measure:'volume'}` | 2 L per bottle, or 750 mL per bottle |

Weight and volume amounts can have up to three decimals (above 0, up to 1,000,000). The shared `public/stock-count-units.js` validates, normalises and converts every kind the same way: ordered quantity = counted amount ÷ `perUnit`, rounded to three decimals. Stock counts keep both the entered amount (`countedQuantity`) and the conversion they used, so history never changes when the setting does; a count submitted with an out-of-date conversion is rejected, and older counts and drafts keep their original units. Targets, recommendations, usage, transfers, prices and supplier orders stay in ordered units. Wastage can be recorded in the same counting unit.
