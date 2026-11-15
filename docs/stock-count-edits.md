# Correcting saved stock counts

Open **Stock count → History**, choose **View count**, then **Edit count** (needs the Stock count edit permission, at the count's own location).

- Change any quantity, add items that were missed (from the catalogue) or remove items counted by mistake, update the notes, and give a **reason** (required, up to 300 characters). **Save correction** applies it; **Cancel** leaves the count unchanged.
- The **original count file is never changed.** The corrected items and notes, a revision number and a private before/after audit of each correction are stored in `stock-count-edits/<countId>.json`.
- The count date, who counted it and when it was saved stay the same. Items whose quantity didn't change keep their saved details; changed or added items take the current catalogue details (and must use the item's current counting unit).
- Everything that reads counts — weekly usage, automatic target levels, Order when, ordering and count recommendations, delivery stock estimates and reports — uses the corrected quantities.
- **View changes** lists every correction with who made it, when, why and each quantity change (added → / removed). History rows show a **Corrected** chip.
- Safety: CSRF, a revision check (another person's newer correction returns 409 so you reload first), and an actor-bound request ID so a retried save is applied once.

API: `PUT /api/stock-counts/:id` `{requestId, revision, reason, items:[{id, quantity, countUnit?}], notes?}` and `GET /api/stock-counts/:id/edits`.
