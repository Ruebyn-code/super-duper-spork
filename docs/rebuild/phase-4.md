# Phase 4 — Invoices

Built in `rebuild/`, still running beside the current app on host port 3001.

**Gate:** an invoice applies its prices once, is blocked when stale, and shows
its history on reopen.

**Status: built and passing.** Five tests in `rebuild/test/invoices.test.js`;
the Phase 1–3 tests still pass.

## What was added

| Module | Responsibility |
| --- | --- |
| `rebuild/invoices.js` | Weekly location invoice, automatic line matching, the price comparison, one confirmation and its audit |
| `rebuild/routes-invoices.js` | `/invoices`, `/invoices/view`, save and apply actions |

## How the rules were kept

- **Matching is automatic and server-side.** A unique SKU wins, then a unique
  exact name; unknown or ambiguous lines keep no product and never propose a
  price. The caller supplies the lines it reviewed — the module invents no
  price, conversion or GST amount.
- **Only differences are proposed.** The review lists current → new rows, and
  applying writes the catalogue price and the private audit in one transaction.
- **Applied once.** An applied invoice can never apply a second time; a stale
  invoice revision, or an item repriced by someone else since matching, is
  refused with `409`.
- **Cost of goods is invoice-only.** An applied invoice's total supplies that
  location's week as its Cost of goods, replacing placed-order costs once, and
  is read live rather than written into report expense rows.
- **Scope.** Invoice reads and writes stay inside the actor's company and
  location.

## Gate evidence

`docker compose -f docker-compose.base44.yml run --rm --no-deps rebuild node --test rebuild/test/invoices.test.js`

| Test | Covers |
| --- | --- |
| invoice lines match a unique SKU, then a unique name, and leave the rest unmatched | SKU first, name second, ambiguity ignored |
| review shows only differing prices and applying writes them once with an audit | unchanged rows hidden, one write, audit recorded |
| a stale revision is refused, and so is an item repriced after the match | `409` both ways |
| an applied invoice totals its week as the invoice-only cost of goods | week total `$X` from the invoice, not orders |
| invoice access stays inside the actor company | cross-company read and apply refused |

## Deliberate limits — not built in this phase

- No upload, browser OCR or PDF/photo preparation: the rebuild accepts the
  lines a human or the existing app's reader produced.
- No weekly bundle across several invoices, and no credit notes.
