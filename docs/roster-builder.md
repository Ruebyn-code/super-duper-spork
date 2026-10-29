# Roster builder presentation

The roster maker uses the selected company's colours, fonts and position colours
with a contained planning grid and a separate, readable financial outlook.
The treatment applies only to authorised desktop/tablet makers on Roster;
other roster sections and published readers keep their existing presentation.

- Week arrows, This week, calendar and Refresh remain native controls.
- Staff, Stacked and Day buttons call the same change/flush handler as the saved
  view selector. Invalid drafts keep the current view and original input values;
  preferences remain per user/company and Day keeps its native date selector.
- Copy week reuses the previous-week review popup on an empty week. Opening it
  never copies. Publish roster remains separate from autosaves and copy actions.
- Draft, Unpublished changes and Published badges derive from the existing
  published snapshot and change flag. Save status preserves pending/error states.
- Hourly projections appear directly beneath the 24 hour labels in Day view.
  Staff, Stacked and phone readers have no separate hourly sales panel. Home
  and Sales hourly forecasts retain their existing displays.
- The same four permission-checked sales/budget/cost metrics sit below the
  toolbar in a thin strip with reduced padding and gaps. All labels, figures
  and original status details remain visible and wrap when needed; missing
  values remain unknown. Phone/published-reader summaries keep their layout.
- A stable marker restores the original summary slot when leaving maker mode,
  including resize to the phone reader. No new financial endpoint is fetched.
- Compact staff rows and shift cards reduce padding and unused row space while
  preserving time text, staff/position pickers, cost-popup and award icons. The drag
  grip sits beside the staff selector above the cost icon. Touch Add Shift
  targets, inline validation/Undo and phone readers keep their native behaviour.
- Staff rows have decorative initials, paid hours and existing full-week costs.
  Today uses the server's Melbourne date; holiday stars remain native markers.
- Award warnings use small red error icons beside staff names and on shift cards.
  Open an icon for a compact, read-only review scoped to that employee or shift;
  repeated issues are grouped with their clause and affected-shift count. Day
  view uses the staff-name icon rather than nesting controls in timeline bars.
  There is no large Roster award panel at the top. Checks without a visible
  staff/shift owner retain a small Other award checks icon beside roster status.
  Unsaved edits disable outdated icons until native recalculation finishes.
  Escape/Close restores focus; review never saves, deletes, publishes or waives
  a blocking issue. Native publishing review and Timesheets checks remain.
- Empty cells retain keyboard-accessible + actions and full accessible labels;
  the full Add Shift text appears on hover/focus and stays visible for touch.
  Shift fields, position selectors, costs and warnings retain their native nodes.
- The Day timeline uses 12-hour labels and native time formatting without changing
  the true hourly scale, overnight intervals, carryovers or drag geometry.

Scope the styling with `body.roster-builder`. Preserve native focus, disabled,
company appearance and reduced-motion behaviour. Phone roster sheets retain only
published schedules and authorised summaries; do not add maker controls or wages.
All saves, drag moves, Delete/Undo, revisions, overlap/availability checks, award
calculations, exports and approved snapshots remain on the existing paths.

Validation uses isolated demo data and fake providers. Check view switching,
focused-input autosaves/cost refresh, invalid drafts, add/delete/undo, drag,
copy review and explicit publishing, desktop/tablet themes and phone privacy.
Update the affected real-screen help guides and build/start the production image
before deployment.
