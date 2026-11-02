# Phases 7 and 8 — Migration and cut-over

Built in `rebuild/`, still running beside the current app on host port 3001.
The console is at `/migration`, Head Office admins only.

**Gate:** a dry run writes nothing and lists every unresolved record; the
import is idempotent and reconciles; cut-over is refused until a reconciled
run, and can be rolled back with the source data untouched.

**Status: built and passing.** Four tests in `rebuild/test/migration.test.js`
plus an HTTP end-to-end run of dry run → apply → cut over → rollback against an
isolated instance.

## What was added

| Module | Responsibility |
| --- | --- |
| `rebuild/migrate.js` | Reads the current app's data directory (`LEGACY_DATA_DIR`, default `../data`), reports a dry run, applies the import with stable natural keys, then reconciles counts and totals |
| `rebuild/cutover.js` | Cut-over status, blockers, the signed-off retirement to read-only, and rollback to rehearsal |
| `rebuild/routes-admin.js` | `/migration` and its dry-run, apply, cut-over and rollback actions |
| `docs/rebuild/data-map.md` | Which source store maps to which rebuild collection, and what does not map yet |

## How the rules were kept

- **A dry run is a read.** It reports what would move, lists orphaned records
  (a missing company, location or account) and any source store with no target
  yet, and writes nothing — not even a run record.
- **The import is idempotent.** Records carry their source identity
  (`legacyId`, or location + week for sales), so a second run updates instead of
  duplicating; the test asserts one week, not two.
- **Nothing is dropped silently.** An unresolved record blocks sign-off and is
  listed in the report; the run's status is `attention`, not `reconciled`.
- **Cut-over needs a reconciled latest run.** Retirement is refused with `409`
  while the latest run has orphans, and records who signed off and which run
  they relied on.
- **Rollback does not touch the source.** The current app's data is never
  written by any of this; rollback returns the rebuild to rehearsal.

## Gate evidence

`docker compose -f docker-compose.base44.yml run --rm --no-deps rebuild node --test rebuild/test/migration.test.js`

| Test | Covers |
| --- | --- |
| a dry run reports what would move, lists orphans, and writes nothing | counts, one orphan, sales stores unchanged, no run record |
| an import is idempotent, keeps the source ids, and reconciles its totals | `legacyId` kept, second run updates one week, totals reconcile |
| an orphan blocks sign-off instead of being dropped | status `attention`, cut-over `409` |
| cut-over is refused until a reconciled run, then can be rolled back | `409` before any run, retire after a reconciled run, rollback to rehearsal |

HTTP end to end, on an isolated instance (`PORT=3100`,
`REBUILD_DATA_DIR=/tmp/...`, `LEGACY_DATA_DIR=/tmp/...` with a synthetic legacy
store, seeded demo accounts), driven through the real forms with a session
cookie:

| Step | Result |
| --- | --- |
| sign in as `admin@harbour.test` | `303 /home`, session cookie set |
| `GET /migration` | `200`, CSRF token present |
| `POST /migration/dry-run` | `200`, report rendered, legacy company listed |
| `POST /migration/apply` | `303 /migration?saved=migration-applied` |
| `POST /migration/cutover` | `303 …saved=cutover-done`; page shows read-only |
| `POST /migration/rollback` | `303 …saved=rollback-done`; page shows rehearsal again |
| `GET /migration?saved=migration-applied` / `?saved=rollback-done` | both notices render |

The test instance and its temporary data were removed afterwards; the sandbox's
own `rebuild/data` and the app's `data/` were not touched.

## What is still needed before a real cut-over

- A copy of the production `DATA_DIR`. This sandbox holds a fresh instance only,
  so the real migration has never been rehearsed against real records.
- A decision on the stores `data-map.md` lists as having no rebuild target yet
  (rich content and media, kiosk devices, billing and intelligence settings).
- Someone to sign off the reconciliation report for the real import.
