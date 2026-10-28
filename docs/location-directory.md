Administrative Head Office locations show Ready and Company overview, with only General/archive controls in their location popup. They require no state, trading hours, manager, sender, target levels or kiosk setup. Head Office is offered in the location selector for authorised company managers and is created only when explicitly selected; retries reuse the same location. Archived offices remain archived until restored.

# Location directory

Locations opens on **Active locations**. It is one continuous list with a section
heading for each saved Australian state or territory. Locations are alphabetical
within each section; **State not set** appears last. Assigning a state in the
location settings or setup popup moves that location to the corresponding section.

Managers can open the separate **Archived locations** menu. It uses the same
continuous list with state sections. Archiving removes a location from the active
list immediately; **Restore location** returns it to the active list. Existing
archive permissions, user-assignment checks, saved settings and records are kept.

Search and location filters apply to the current active/archive menu. Search
matches location names, state codes and full state names. Switching menus clears
these filters; counts and state headings describe only the visible menu. Direct
links to archived locations open their archived entry for authorised managers.

Open **Edit location → Supplier delivery days** to choose each supplier's regular
Monday–Sunday delivery days for that store. Use **Find supplier** to filter the
list. Regular days can be supplemented by dated exceptions; **Save settings** saves these choices
with the rest of the location popup. Switching tabs or closing and reopening the
popup retains unsaved choices. Each location has independent schedules, including
when it uses the same suppliers as another location.

Location management permission is required to edit delivery days. Staff with
Ordering access can see configured days beneath the selected supplier in
Catalogue and in that supplier's cart group. Saved days refresh in open ordering
pages. A conflicting edit keeps the draft and asks you to reload delivery days;
reloading a changed draft asks before discarding it. Archived locations retain
their schedules when restored.

Schedules are stored in **data/location-supplier-delivery-days/[location ID].json**
with revisions and company/location bindings. They describe regular delivery days;
they do not reserve a delivery or restrict when staff may order. Advanced timing
can drive estimated stock coverage without changing original orders, counts or
weekly usage targets. See [Delivery planning](supplier-delivery-planning.md).
