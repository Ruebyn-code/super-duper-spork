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

## Equipment list and location equipment

- **Equipment list** items describe equipment once for the **Company list** or the **Network
  list**: name, category, make, model, supplier, service contact, a default service interval and
  notes. Company list items need `equipment.manage` + `locations.all`; network list items also
  need `network.access`. List items can be archived (no new locations), never deleted.
- **Choose equipment** shows the list to people with `equipment.manage` at the selected location.
  Ticking an item creates (or restores) that location's own copy; unticking retires the copy and
  keeps its history, and ticking again brings back the same record. Each copy has its own area,
  asset tag, serial number, purchase/warranty details, status, notes, optional service interval
  (blank uses the list default), service history and problem reports.
- List edits change the name, category, make, model, supplier and contact shown at every location;
  they never touch location details or history.
- **Only at this location** adds a one-off item with its own description.
- Items saved by the short-lived shared-item version are migrated on read into a list item plus a
  copy at their original location that keeps their history (stable derived list IDs).

## Data and rules

- Records live in the network's `equipment.json`, list items (`type: "list"`) and location items
  (`catalogId` when chosen from the list). Every request uses the session's selected location;
  other locations' items and history never appear.
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
| POST | `/api/equipment` | Add a one-off item for the selected location (manage) |
| PUT | `/api/equipment/:id` | Edit a location item with `revision` (manage) |
| POST | `/api/equipment/list` | Add a list item with `scope` company/network (list authority) |
| PUT | `/api/equipment/list/:id` | Edit/archive a list item with `revision` (list authority) |
| PUT | `/api/equipment/list/:id/location` | `{present}` ticks it on/off for the selected location (manage) |
| POST | `/api/equipment/:id/services` | Record a service/repair (manage) |
| POST | `/api/equipment/:id/faults` | Report a problem (view) |
| POST | `/api/equipment/:id/faults/:faultId/resolve` | Resolve with a note (manage) |
| GET | `/api/equipment/export` | CSV (manage) |

Tests: `equipment.test.js`. Help guide: `equipment` in `public/help-guides.js`.
