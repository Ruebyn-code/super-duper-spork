# Phase 3 — Sales and reporting

Built in `rebuild/`, still running beside the current app on host port 3001.

**Gate:** an imported week reconciles to its source sheet and drives the same
forecast the current app shows; reporting never invents a number.

**Status: built and passing.** Six tests in `rebuild/test/sales.test.js` and two
in `rebuild/test/reporting.test.js`; the Phase 1–2 tests still pass.

## What was added

| Module | Responsibility |
| --- | --- |
| `rebuild/sales.js` | Daily sales weeks, the weekly report import, hourly sales, operating expenses, budgets, forecast and the financial week |
| `rebuild/reporting.js` | Read-only company overview: sales, costs, profit, margin, location ranking, training and checklist progress |
| `rebuild/routes-sales.js` | `/sales` page and its save, import, hourly, expense and budget actions |
| `rebuild/routes-admin.js` | `/reporting` and the Phase 7–8 migration console |

Reused rather than re-derived, so a forecast cannot drift:

- `sales.calculate()` — the current app's own projection maths, fed rows shaped
  exactly as it already expects.
- `hourly-sales.forecast()` — the allocate-by-weekday-pattern split.
- `public/rostering-model` — the projection the hourly split is drawn from.
- `holiday-projections.adjustments()` / `.apply()` — the public-holiday
  adjustment, applied over a derived location snapshot.

## How the rules were kept

- **One source per historical day.** A day counts its weekly report's Till +
  Uber Eats + DoorDash only when all three are recorded cents (explicit zero
  included); otherwise that day falls back to Daily sales. Nothing counts twice.
- **An import reconciles or is refused.** A row total that disagrees with its
  channels refuses the whole import, so a saved report always adds up, and the
  source text's SHA-256 is kept as its checksum.
- **Weeks carry a revision.** A stale save is refused with `409` rather than
  overwriting someone else's numbers; an identical resave returns the stored
  week untouched.
- **Incomplete means unknown.** A week with any unrecorded day (or a pending
  order price) reports `profitCents: null` and no margin — never a smaller
  number that looks real. The same rule ranks locations in Reporting.
- **Reads never write.** Reporting builds its overview from records the other
  phases already saved; the test asserts the sales stores are byte-identical
  after an overview read.

## Gate evidence

`docker compose -f docker-compose.base44.yml run --rm --no-deps rebuild node --test rebuild/test/sales.test.js rebuild/test/reporting.test.js`

| Test | Covers |
| --- | --- |
| a saved week keeps a revision, and a stale save is refused | `revision 1 → 2`, stale `409` |
| an imported week reconciles to its sheet, and a mismatched total is refused | `$1,350` Monday, 64-char checksum, broken row `400` |
| the weekly report wins over daily sales for a day, and the forecast averages four completed weeks | report beats a later daily edit; Tuesday projection = four-week weekday average |
| hourly sales split a projected day by the same weekday pattern and sum exactly | hours sum to the projected total, historical shape preserved |
| a complete week reports profit, while a partially recorded week reports unknown profit | `$4,500` profit at `64.29%`; partial week `null` |
| sales writes stay inside the actor company and location | cross-company and cross-location writes refused |
| an incomplete location is unranked and keeps overall totals unknown | rank/profit `null`, company totals `null`, read-only |
| training and checklist progress appear only for viewers with those permissions | staff without `learning.report` see no training report |

HTTP checks behind a Head Office session: `/sales` and `/reporting` both return
`200` with rendered content and no error text.

Signed-in visual checks in the platform preview are **not automatically
verified**: the rebuild is a second project and the preview browser does not
carry its session between calls. Sign in with a demo account (password on the
sign-in card) to see the screens.

## Defect found and fixed

Seeding the demo business history made four earlier test files assert against a
ledger that was no longer empty — sales, reporting, comms and the workforce
"no employer" case failed. `seed()` now takes `business:false` to seed accounts,
locations and the catalogue only; those fixtures use it, and the preview keeps
the full demo history. All 50 rebuild tests pass.

## Deliberate limits — not built in this phase

- Weekly report import is CSV paste; the XLSX/PDF/photo readers and the
  intelligence extraction of Phase 3's current app stay with the existing app.
- Operating expenses are add-only in the rebuild; there is no expense editing,
  category management or quarter dashboard yet.
- No scheduled or emailed reports (the current app's AI reports are not ported).
