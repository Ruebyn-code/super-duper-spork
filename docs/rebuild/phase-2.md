# Phase 2 — Ordering and stock

Built in `rebuild/`, still running beside the current app on host port 3001.

**Gate:** count → recommendation → cart → order with snapshotted prices, plus a
transfer that moves stock between two locations in one atomic write.

**Status: built and passing.** Nine tests in `rebuild/test/ordering.test.js`
plus HTTP checks against the running service; the ten Phase 1 foundations tests
still pass after the store and scope changes below.

## What was added

| Module | Responsibility |
| --- | --- |
| `rebuild/ledger.js` | Stock movement ledger: whole-thousandths deltas, balances, on-hand per location |
| `rebuild/catalogue.js` | Suppliers and stock items, including the ordering rules and price |
| `rebuild/stock.js` | Stock counts (snapshot + ledger movement in one write) and the wastage log |
| `rebuild/transfers.js` | Send, receive and cancel stock transfers between two locations |
| `rebuild/ordering.js` | Usage window, recommendations, cart review, placing orders, deliveries |
| `rebuild/seed-ordering.js` | Demo catalogue from `catalogue/book2.json` and four weeks of Sunday counts |

Reused rather than re-derived, so the two apps cannot drift:

- `public/stock-order-rules.js` — minimum order, multiples, rounding cut-off and
  separate-unit rounding, order-when gating, `describe()` labels.
- `par-levels.windowFor()` — the four completed Sunday–Saturday cycles ending
  last Sunday, in Melbourne time.
- `order-numbers.prefix()` — the `CC-LOC-0001` order-number format.

`rebuild/store.js` gained the Phase 2 collections and `changeMany()`, which
stages several collections and writes them together, restoring what it already
wrote if a later write fails. Every mutation now runs through one queue, so a
record and the stock movements that explain it cannot interleave with another
write. `rebuild/access.js` gained `read()`, the same scope resolution without
implying a mutation.

## How the rules were kept

- **A count is a physical snapshot.** Saving one appends the count record and
  the movement that brings on-hand to the counted quantity, in one write.
  Counting `10` then `6` leaves on-hand at `6` with deltas `+10000, -4000`.
- **Target level and order when.** Averages come from the latest count on each
  completed Sunday; the target level rounds up and "order when" is the greatest
  three-decimal count no higher than the average. An item at or below its
  order-when level is recommended `level − counted`, rounded by its own rule;
  above it the suggestion is `0`. No counts means no suggestion, not an
  invented number.
- **Prices are snapshotted.** The cart review shows the price and total that
  will be saved; changing the catalogue afterwards leaves the placed order and
  its total untouched.
- **Order numbers are reserved with the order.** One sequence per company and
  location, shared by every order path, never recycled; a retried request id
  returns the same order instead of placing a second one.
- **Only a confirmed transfer or delivery moves stock.** Sending a transfer
  records the intent; receiving it debits the sender and credits the receiver
  in one transaction, so the two ends can never disagree, and a repeated
  receive returns the same transfer without adding movements.
- **Wastage is a log, not a stock movement.** It keeps the price snapshot and
  the reason and never subtracts stock again, changes targets or places orders.

## Gate evidence

`docker compose -f docker-compose.base44.yml run --rm --no-deps rebuild node --test rebuild/test/ordering.test.js`

| Test | Covers |
| --- | --- |
| count sets on-hand, later count applies the difference | count snapshot + deltas |
| recommendations use the four completed Sunday weeks | level `10`, order-when `9.75`, suggestion `1`, then `0` above the trigger |
| cart rounds to the item rule and keeps prices | `7 → 12` at 6s, `$148.08` snapshot survives a price change |
| order numbers reserved once, retry reuses the order | `CC-LOC-0001`, sequential, `409` on a reused reference |
| delivery adds stock exactly once | `+6`, second confirmation adds nothing |
| transfer moves stock in one confirmed write | nothing moves on send, `−4/+4` on receive, two movements, no duplicate on retry, over-send and cross-company refused, cancel inert |
| scope | manager cannot count at Harbour Central or order for Riverside; can do both at Harbour Street |
| ordering manager cannot change stock settings | `stock.manage` denied |
| wastage keeps a cost snapshot | `$12.80` estimated, no ledger movement |

HTTP checks against the running service (`curl` with a session cookie):

- `/ordering` renders the order sheet for the signed-in Head Office account:
  usage line "4 completed Sunday counts", 128 suggested quantities, nav linking
  to Stock.
- `POST /ordering/cart` renders "Double check your order" with one line and a
  `$181.08` total.
- `POST /orders` redirects back to the sheet with "Order HGR-HAR-0001 placed",
  and `/stock` lists that order under "Waiting on a delivery" with a Confirm
  delivery action.
- `/stock` shows the transfer, wastage and count forms; `/stock/counts` renders
  128 count inputs with on-hand placeholders.

Signed-in visual checks in the platform preview are **not automatically
verified**: the rebuild is a second project, and the preview browser does not
carry a session between calls for it. Sign in with a demo account to see the
screens (password in the sign-in card, or `REBUILD_DEMO_PASSWORD`).

## Defect found and fixed

`rebuild/accounts.js` and `rebuild/locations.js` declared `fail()` as a
function that *returned* an error instead of throwing it, so name validation in
"invite a user" and "add a location" never fired. Both now throw, matching the
new Phase 2 modules. No behaviour changes beyond rejecting the input that was
already meant to be rejected.

## Deliberate limits — not built in this phase

- The cart is the review page: it carries its quantities forward and is
  revalidated when the order is placed. There is no server-side cart yet.
- One transfer item per form submission; the module accepts many and the
  current app's page keeps its cart-based multi-item flow.
- No supplier emails, SMS or sending states (Phase 6), no delivery weekday
  planning, no count-unit conversions, no per-item manual target editing
  (`stock.targets`), no order-history editing/deletion and no invoice price
  application (Phase 4).
- Recommendations ignore delivery plans, so every item uses the plain
  order-when rule until Phase 4 adds them.
- The stock page groups nothing: counts, transfers and wastage lists are
  chronological, not grouped by area or supplier.
