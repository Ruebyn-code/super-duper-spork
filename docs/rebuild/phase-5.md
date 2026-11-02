# Phase 5 — Workforce

Built in `rebuild/`, still running beside the current app on host port 3001.

**Gate:** a published week costs exactly what the shared MA000003 calculator
says for identical inputs, and approved pay snapshots stay frozen after later
rate changes.

**Status: built and passing.** Five tests in `rebuild/test/workforce.test.js`;
the Phase 1–4 tests still pass.

## What was added

| Module | Responsibility |
| --- | --- |
| `rebuild/workforce.js` | Employer setup, dated employment profiles, roster shifts, publication with frozen costs, the clock, timesheets and approval, availability and leave |
| `rebuild/routes-workforce.js` | `/workforce` page plus shift, publish, unpublish, clock, approve, availability, leave and employer actions |

Reused rather than re-expressed — no pay rule is rewritten:

- `fast-food-award.calculate()` — the current app's own MA000003 calculator,
  given the employer config, dated profiles and shift items in the shapes it
  already consumes.
- `award-break-plan.build()` — planned breaks.
- `public/rostering-model` — the week and date helpers both rosters and
  timesheets use.

## How the rules were kept

- **Publication freezes its own output.** A published week stores the
  calculator's cost snapshot per shift; a later rate or super change cannot
  rewrite a cost somebody already relied on. Approval does the same for actual
  timesheets.
- **A published week is not editable.** Shifts in a published week refuse
  edits with `409` until the week is explicitly withdrawn.
- **No guessed calendar.** Publishing without the employer setup that carries
  the reviewed calendar is refused with `409` ("Enable native award
  calculations") rather than costed with an assumed holiday calendar.
- **Overlaps are refused.** Two shifts for the same person at overlapping times
  cannot both be saved.
- **Wages are permissioned.** A staff account cannot publish a roster or read
  pay history; the refusal is `403`, not a filtered page.

## Gate evidence

`docker compose -f docker-compose.base44.yml run --rm --no-deps rebuild node --test rebuild/test/workforce.test.js`

| Test | Covers |
| --- | --- |
| a published week costs the same as the shared award calculator for identical inputs | recomputed total equals the frozen total; two frozen shifts |
| a published cost and an approved pay snapshot stay frozen after a rate change | costs unchanged after the rate edit |
| overlapping shifts are refused and a published week must be withdrawn before editing | overlap refused, published edit `409`, edit allowed after withdrawal |
| publishing without a reviewed calendar is refused rather than guessed | `409 Enable native award calculations` |
| a staff account cannot publish a roster or read pay | `403` on both |

HTTP check behind a Head Office session: `/workforce` returns `200` with the
roster, publish controls and timesheet sections rendered.

Signed-in visual checks in the platform preview are **not automatically
verified** (second project, no session carried between calls); sign in with a
demo account to see it.

## Deliberate limits — not built in this phase

- Roster editing is a per-shift form, not the current app's drag-and-drop
  builder with copy/duplicate and undo.
- Clock in/out is recorded; the award's automatic break planner is costed but
  there is no break-change workflow or early-start approval.
- Availability and leave are recorded and decided; there is no leave accrual,
  super calculation report or employment-document signing yet.
