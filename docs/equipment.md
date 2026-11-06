# Equipment

Equipment (`/equipment`, main navigation; phones open it from **More**) is a register of the
selected location's equipment, its service history and staff problem reports.

## Permissions

| Permission | Default levels | Allows |
| --- | --- | --- |
| `equipment.view` | Ordering manager, Franchisee, Head Office | Read the selected location's register and service history, and report problems |
| `equipment.manage` (needs `equipment.view`) | Franchisee, Head Office | Add and edit equipment, record services/repairs, resolve problems, export CSV |

Only exact historical default roles and full network roles gain these grants (`equipmentVersion`
in `permission-levels.json`); customised roles keep their existing access. Owners can switch the
whole feature off per network in the console (Networks → Features → Equipment).

## Shared lists

Each item is added to one list, chosen in **Add to** (and changeable in Edit details):

| List | Shows at | Who can add or change it |
| --- | --- | --- |
| This location (default) | The location it was added at | `equipment.manage` |
| Whole company | Every location in that company | `equipment.manage` + `locations.all` |
| Whole network | Every location in every company of the network | `equipment.manage` + `locations.all` + `network.access` |

Records saved before lists existed are treated as location items. Anyone who can see an item can
report a problem; services, edits and resolving need the authority for its list. Narrowing a
shared item to one location pins it to the editor's selected location. The page's **List** filter
and the Company/Network badges show where items come from, and the summary covers everything shown
at the selected location.

## Data and rules

- Records live in the network's `equipment.json`, each with a list (`scope`) plus the company/location
  it was added at. Every request uses the session's selected location; items outside its list never appear.
- Writes require CSRF. Creates, services, problem reports and resolutions carry a `requestId`, so
  retries apply once; a reused ID with different content is rejected. Edits are revision-checked.
- The next service date counts from the latest service, repair or inspection (deep cleans are
  excluded), or the purchase date, plus the saved interval. Without an interval nothing is due;
  without a starting date the item shows that a service or purchase date is needed. Services due
  within 14 days and warranties ending within 30 days are highlighted.
- Reporting a problem never changes the item's status; a manager chooses the status explicitly
  (including when recording a service). Retired equipment keeps its history, cannot receive new
  problem reports and is excluded from the summary.
- Purchase and service costs are returned only to `equipment.manage`. Dates use Melbourne time
  and service dates cannot be in the future.
- Global search finds equipment by name, area, make, model, serial and asset tag for people with
  `equipment.view`; searching never writes.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/equipment` | Register, summary and options for the selected location |
| POST | `/api/equipment` | Add (manage) |
| PUT | `/api/equipment/:id` | Edit with `revision` (manage) |
| POST | `/api/equipment/:id/services` | Record a service/repair (manage) |
| POST | `/api/equipment/:id/faults` | Report a problem (view) |
| POST | `/api/equipment/:id/faults/:faultId/resolve` | Resolve with a note (manage) |
| GET | `/api/equipment/export` | CSV (manage) |

Tests: `equipment.test.js`. Help guide: `equipment` in `public/help-guides.js`.
