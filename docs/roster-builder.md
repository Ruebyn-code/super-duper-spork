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
  preserving time text, staff/position pickers, cost-popup and scheduling-error icons. Drag
  the blank part of a card or its staff/position selector with a mouse; an
  ordinary click still opens the selector. The icon-free footer provides a broad
  touch drag surface, while quick swipes elsewhere retain scrolling. Touch Add
  Shift targets, inline validation/Undo and phone readers stay native.
- Staff rows have decorative initials, paid hours and existing full-week costs.
  Today uses the server's Melbourne date; holiday stars remain native markers.
- Each saved shift has a green border only when it matches its own published
  snapshot. Availability/approved-leave conflicts, scoped configured shift-length/rest limits, unresolved break plans and failed
  saves take priority with a red border in Staff, Stacked and Day views. Other
  employees’ shift issues are excluded. Green denotes publication, not compliance.
  Unsaved/pending changes suppress stale green and saved checks until recalculated;
  a failed save retains its current error. Position colours, selection/focus,
  native dragging and actual calculations remain unchanged.
- Hover over the top of a red card/bar or focus the card to read its current issues.
  The theme-aware tooltip stays above clipped grids, can be hovered for reading,
  and closes with Escape, scrolling or context changes without moving focus or
  writing data. Click the existing red icon for a persistent review. Phone sheets
  retain published-only privacy and their existing presentation.
- The builder has no award review, staff/general award icons or publication review
  notes. Card icons and Warnings contain scheduling issues only: configured daily/
  weekly length, minimum shift/rest limits, availability/leave, unresolved planned
  break times and save errors. Pay/profile/source/IFA review messages never colour
  cards or appear as builder warnings. Missing cost setup stays in the Costs tab.
- Publishing retains current permissions, revisions, overlap and automatic-break
  validation. It calculates and freezes the current planning estimate internally,
  keeping unknown costs unknown; it does not require a reviewed fingerprint/note
  or create an award attestation. Historical reviews remain untouched. Actual
  Timesheets reviews, approval blockers and frozen approved pay are unchanged.
- Empty cells retain keyboard-accessible + actions and full accessible labels;
  the full Add Shift text appears on hover/focus and stays visible for touch.
  Shift fields, position selectors, costs and warnings retain their native nodes.
- Drag previews keep the grab position, use 12-hour times and update once per
  animation frame. Edge scrolling eases with pointer distance and elapsed time,
  preserving fractional pixels across display refresh rates. The release checks
  the latest pointer target; Escape, pointer cancellation or lost capture cancels
  without moving a shift. Fields and cost/error/Undo buttons remain clickable,
  and pending edits, validation, revisions and final saves use the native paths.
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
