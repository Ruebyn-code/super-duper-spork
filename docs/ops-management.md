# Ops management

Open **Ops management** from the main navigation, or **More → Ops management** on a phone. A company has one checklist library; switching the selected company changes the library. The location filter can show all locations the user can access in that company.

Head Office and Franchisees can create templates by default. All signed-in staff can complete them. Settings → Permission levels has separate **View**, **Complete** and **Manage checklists** controls. Existing customised roles keep their grants; grant these controls explicitly where needed.

## Two-stage checklist builder

Open **Checklist builder → New checklist** or **Edit checklist** on an existing card. Enter the name and instructions, then add its compact step cards. Open a step's chevron for its type/options and drag its grip to rearrange. Arrow keys move a focused grip; Escape cancels a drag. Moving a section carries the following steps until the next section.

The builder has two stages inside the selected checklist: **1 Checklist** for the name, instructions and steps, and **2 Plans** for configuration. Use the stage buttons or **Continue to Plans** to switch. Pending content saves before entering Plans; incomplete or invalid content stays in Checklist with an error. Switching back retains the same fields, step order and open step options.

Checklist intelligence appears only in the Checklist stage. Plans shows only its dedicated OpStack intelligence plan button; switching back restores checklist intelligence without changing the draft.

The **Plans** stage shows **Your planner**, the checklist’s single plan with its status, timing, locations and audience. Use **Edit planner** to open it, or **Set up planner** if none exists. The three groups are **Plans**, **Locations** and **Assignees**, all editing that same planner. Changes use the native serial autosave. Closing returns to Plans with focus and content preserved. **Back to checklist** returns to content; **Done** returns to the list.

On a computer, a live **iPhone 18 Pro–style phone preview** sits to the right of both stages. The preview panel keeps its original 340 px width. The phone fills the available width inside it with minimal surrounding space and uses the supplied phone-frame reference with metallic edges and its camera cutout. The builder has compact headings, a single toolbar for the stage buttons and Back, shorter input rows and denser step cards. The preview starts at the top of the desktop content area, preserving its previous lower edge. The phone is centred and maximised within that width and height so the full frame remains visible, including on shorter laptops; the checklist content scrolls inside the phone. The preview stays fixed beside the editor when the step list scrolls. It uses the checklist’s mobile field layout, required markers, descriptions, number formats, media controls and signature fields. It reflects draft edits and step order without creating records, saving answers or uploading files. Collapse/expand it with the phone icon; that choice is remembered for the signed-in account and company in this browser. The preview stays hidden on tablets and phones.

A checklist cannot add a second planner. Older checklists with several saved planners require choosing the one to keep through the legacy selector and **Keep this planner**. Until that explicit selection their settings are read-only and their existing schedules are preserved. Other planners are retired after selection, retaining saved records in History.

Managers can create content for their selected company. Editing shared content requires access to every location used by any planner, including paused planners. Managers with partial location access can open the checklist with its content read-only and edit a planner only when all its assigned locations are accessible. A shared planner requires access to all of its assigned locations before it can be edited.

## Plans group

The **Plans** popup puts the planner name and the Plans / Locations / Assignees tabs in its header beside the title; the Active planner switch sits beside **When it happens**. With location trading hours, each of Available from, Active until and Due at is one choice (At, Before or After opening/closing) plus a Minutes amount, saved as the same `{anchor, offsetMinutes}` values as before; the Plan breakdown sentence then shows the clock times of the next window for the first selected location, for example “available from 1 hour before closing (9:00 pm) until closing (10:00 pm) … Times are for Richmond on Thursday 5 Nov.” The popup groups then **1 When it happens** for the type, recurrence and dates, and **2 Available hours & deadline** for fixed times or location trading hours. Unscheduled planners keep date/time sections tucked away until a scheduled type is chosen. **More options** contains the optional scheduled start time, reminder, priority and instructions; it opens automatically for saved non-default options so existing settings remain visible. A **Plan breakdown** at the bottom shows the result. The popup uses a schedule-dialog look: field labels sit on each field's outline, sections are flat with dividers, and the four type cards show an icon with the selected card filled in the company primary colour. Group and planner switching retains drafts through the existing serial autosave; closing returns focus to the matching planner row. Phones keep touch-sized controls, a scrolling form and persistent Close/Done actions. Selected type cards and weekdays use the company primary colour.

Choose:

- **Checklist type**: **Recurring** repeats on a schedule; **On-demand** can be started manually and repeatedly; **Once off** has one occurrence per location; **Unscheduled** keeps the configuration out of the team's checklist list.
- **When it happens** for recurring checklists: Hourly, Daily, Weekly, Fortnightly, Monthly or Yearly. Hourly and Daily can use selected weekdays. New weekly and fortnightly schedules repeat from the configured start date, every 7 or 14 days. Monthly schedules retain the start day, clamping to the final day of shorter months; yearly schedules similarly clamp a 29 February anniversary to 28 February in non-leap years.
- **Start date** and **Checklist start time**: an occurrence becomes available from its first scheduled day/time. Start time belongs to the chosen recurrence, rather than changing the date anchor each day. There is no end-date field. New planners continue until paused; a once-off planner still has one occurrence. Existing saved end dates remain effective while viewing, and are cleared on the next explicit settings edit.
- **Due time** and **Due day**: choose the day relative to the start, including Next day for an overnight deadline. Existing weekly schedules retain their original calendar-week identity and due day when unrelated settings are edited.
- **Active from / Active until**: daily opening and closing hours for new starts. Blank opening uses the checklist start time, or midnight. A closing time before opening continues overnight. Leave both blank for no daily hour restriction; the scheduled start time still applies. The server uses its Melbourne clock and rejects attempts to bypass a window by selecting an earlier date. Work already started remains available in History to finish after the window closes; its expired card leaves Active.
- Optional **In-app reminder**, **Priority**, **Planner instructions** and **Active planner**. Reminders mark incomplete cards Due soon before the deadline and Overdue after it, while Ops management is open; no background emails or push notifications are sent. Pausing stops new occurrences without deleting records.

The preview shows upcoming dates. Melbourne daylight-saving gaps move a skipped time to the first real minute after it; repeated clock times use the later occurrence. Daily overnight windows retain the previous day's occurrence after midnight until closing.

## Hourly repeats and the Active list

A checklist with exactly one checkbox response shows a completion tick directly on its Active card. Press it to confirm that step and complete the checklist without opening the reader. The normal audience, active-window, completion permission, revision and saved timestamp rules still apply. Instructions and sections do not count as responses. A text, number, selection, photo or signature step still opens normally to collect its answer, as do checklists with multiple responses. Completed ticks stay green and cannot reopen completed answers for editing.

Choose **Recurring → Repeat → Hourly** for a separate checklist every hour within the planned active window. It works with fixed times and location trading hours. For example, 9:30 am–12:00 pm produces 9:30–10:30, 10:30–11:30 and 11:30–12:00 occurrences. Each has its own saved answers and completion record; completing one does not complete the next. Each occurrence is due and finishes at the next hour or the planner’s **Active until**, whichever is earlier. A reminder can be up to one hour before that finish. Choose repeat weekdays as needed.

Intelligence understands requests such as “make this checklist repeat hourly during trading hours, plus a separate closing planner”. One Hourly planner handles all its hourly occurrences; separate instructions can generate several different planner drafts for the same checklist. Review and activate the paused suggestions as usual.

**Active** starts a checklist only during its planned start/finish window. Weekly, fortnightly, monthly, yearly and once-off planners appear on their scheduled start day, rather than staying visible throughout the recurrence period. **Due day** sets the deadline and does not extend Active visibility. The finish is **Active until**, or the trading-hour end; when no fixed finish is set, it is midnight at the end of the planned day. Explicit overnight windows keep their original work/trading date until their next-day finish.

Cards stay on their day after their finish passes. The Checklists page asks for the whole day (`GET /api/ops-management?whole=1`): each task carries `window` (`open`, `closed` or `upcoming`). Completed and started checklists from that day stay listed, including earlier hourly occurrences and finished on-demand runs; a closed window that was never started shows **Missed** and cannot be started. Started records can still be resumed; nothing is automatically completed or deleted. Other readers of the list (Home, notifications, search and reports) leave out `whole` and keep only open windows.

Checklists that open later today stay hidden until **Show upcoming** (a switch with a count in the filter menu) is turned on; the choice is remembered on that device, marks the filter button as filtered and is turned off by Reset filters. Upcoming cards are dashed and show their opening time. Opening one shows a read-only **Preview · opens …** of its steps for this location and person (`preview` on upcoming tasks only) — it never creates a run, and starting still waits for the window to open. An hourly checklist that hasn't opened yet shows its first hour.

Pinned checklists are shared by the whole company. People with `ops.manage` see a pin button on each card; pinning saves the plan's ID in the company's `pins` list in `ops-management.json` through the CSRF-protected `PUT /api/ops-management/pins` (`{plannerId, pinned}`, plan must be in the company and at an accessible location, up to 100 pins, repeats are harmless). Every day, hour and location of that plan stays pinned. `GET /api/ops-management` returns the company's `pins`; everyone sees pinned cards at the top (with a static pin icon for people who can't change it), even while Show upcoming is off. Pins never change schedules, runs or permissions. A reader already open at the boundary retains its answers and focus. New runs save their opening and finish instants, so later schedule/hour edits do not change their finish. Older records without these instants use their saved planner configuration without rewriting history.

The list refreshes at the next scheduled boundary and quietly rechecks while browsing. It does not reload open checklists or builder drafts. Viewing or refreshing never starts a run. Hourly intervals follow elapsed time through Melbourne daylight-saving changes, with distinct records for repeated clock hours and no nonexistent spring-forward hour.

## Use location trading hours

In **Planners → Timing**, choose **Location trading hours** instead of **Fixed times**. Set **Available from**, **Active until** and optional **Due at** to Opening time or Closing time, with a minute offset. Negative minutes mean before; positive minutes mean after. For example, Available from Opening −30, Active until Closing +0 and Due at Opening +0 makes opening checks available 30 minutes before each location opens and due at opening. Closing checks can use Closing −30 through Closing +60, due Closing +30.

Each assigned location uses its own saved **Location settings → Trading hours**, including different hours on each weekday. Closed trading days are skipped. Missing hours or a window whose end precedes its start prevent new starts and show an explanation; the app never invents hours. An overnight closing, or a 24-hour day with matching opening/closing times, closes on the following date. Offsets can cross midnight and retain the opening trading date. Due day still refers to the scheduled date; use Same day for a deadline relative to that trading day’s overnight closing.

The existing Melbourne clock and daylight-saving conversion apply. Checklists become available at the configured start; a user explicitly opens one to start its record. Merely viewing the list does not create runs. Changing trading hours changes future availability and deadlines, while existing runs retain their saved due instant and planner configuration and remain available through their record/history. Fixed schedules remain available without intelligence or an API key.

## Create a plan with OpStack intelligence

In a saved checklist’s **Plans** stage, choose **OpStack intelligence plan**. Describe one recurrence and window, for example “repeat hourly from opening until closing”. The preview contains at most one paused plan, without an end date. A checklist draft can also include one optional paused planner.

**Apply paused plan** creates the first planner or updates the existing one in place. Replacement is explicit and pauses it for review; existing locations and permission-level assignees are preserved. Generation and cancellation create nothing. Stable retries finish the same write without adding another planner, while a later edit requires reopening the current Plans. Review timing, Locations and Assignees before activating. Intelligence never chooses IDs or receives location hours; normal authoring access and the shared company request budget remain enforced.

## Locations group

Choose the locations using this planner. Only accessible locations in the selected company can be added. Existing assignments outside a manager's access are never silently removed. Users still need current location access to view, start, save or upload to its checklists.

## Assignees group

Use **All permission levels**, or choose specific levels. The choices include network levels and the selected company's overrides/custom levels. Selection does not grant application permissions: users also need checklist view/complete grants and access to the location.

The audience is checked on the server for tasks, starts, history, record reads/writes and private uploads/downloads. Changes take effect on subsequent requests, including existing records. Management access permits configuring settings; it does not bypass an excluded permission audience for checklist records. Roles are stored by stable ID so renaming a level does not break the assignment. A removed level remains unavailable and cannot grant access.

## Existing data

Legacy assignments and schedules continue to use stable planner IDs. Editing grouped settings does not recreate a planner or rewrite an existing checklist snapshot. Scheduled starts are deduplicated by planner, location and period; separate planners using the same content keep independent answers.

New content and timing edits affect new records. Drafts and completed records retain their original instructions, due information and revision snapshots. Current location and assignee restrictions still apply. Completed records stay read-only. Backups continue to include the same data file and private media directory.

## Complete and review

The active view has a day heading and location selector, a previous/next-day strip with a live Melbourne clock, and search, sorting and filters. It initially selects the current app location; All locations remains available within the user’s accessible locations. Dates cannot advance past today. Sort by status, due time, priority or name, and filter by status or priority. Run on-demand opens an authorised existing checklist for the selected date/location without creating a new template. Checklists shows a dense grid of narrow cards, with two cards side by side on typical phones. The phone bottom bar’s Checklists icon opens this active view. Phone users open Checklist builder and History through More; the local sidebar remains on larger screens. Create checklists through Checklist builder; the active view does not show a New checklist action. Click or tap anywhere on a card to start, resume or review it; keyboard users can focus the card and press Enter or Space. Each card shows saved response progress, excluding sections and instructions. Completed cards turn green and show a full progress bar, including checklists with optional unanswered steps. Completing every response step automatically finishes the checklist after its saved answers are confirmed. New starts still respect active windows and completion permissions. Opening a checklist shows a desktop popup. On tablets and phones it fills the app viewport and hides the shared navigation until closed. The same form and draft stay in place when resizing or rotating.

Valid answered steps turn green immediately, with a check mark and an answered/total progress counter. Clearing an answer or entering an invalid number removes the green state. Zero and a “No” answer count as valid answers. Sections and instructions do not count toward the response total. Green indicates a valid local answer. Progress saves automatically after a short typing pause, without refreshing the fields. When every response step is answered, the checklist completes automatically after autosave finishes. Text, numbers and dates wait until you leave the field; multiple selections wait until their menu closes; uploads and signatures must finish successfully. Opening a previously answered draft or the inert preview does not complete it. A failed save or revision conflict leaves it unfinished. **Complete checklist** remains available to finish with optional responses left blank, or to retry completion after an error. Closing flushes pending changes; invalid entries and failed saves remain visibly unsaved, and closing asks before discarding them. Active uploads must finish first. **Retry save** retries a failed draft save; revision conflicts require reloading saved progress so another person’s changes are not overwritten. Progress is shared within its location. Completion validates required steps, number precision and limits, selection access and uploaded files. Photo/video and file steps allow 1–10 submissions. Photos and other files support up to 10 MB each; MP4, WebM and MOV videos support up to 25 MB each. Supported documents include PDF, Office documents, text, CSV and ZIP; audio uploads are also supported. Videos preview inside the checklist and support seeking.

Signature steps can require a drawn signature, a typed name, or either method. Drawings are private PNG files saved with the entered signer name and the signed-in user’s completion attribution and timestamp. Date and time steps can collect a date, time, or both, using Melbourne wall-clock values.

History retains drafts and completed records with location, author, timestamps, answers and the original template version. Completed records are read-only. Edits to a template affect new records, not existing drafts or completed checklists. Concurrent saves use revisions; reload saved progress before retrying a conflicting change.

## Step timestamps and timed sections

Each valid changed response receives a server timestamp and the signed-in person's name when it saves. The step shows its **Saved** date and time in Australia/Melbourne, including seconds. Unchanged autosaves and completing the checklist keep that timestamp. Editing the answer records a new completion time; clearing or unchecking it removes the current completion time and records when it was cleared. The server retains the first recorded time and previous completion time. Existing answers with no step-level timestamp show **Completion time unavailable**; the system does not invent historical times. User-entered Date and time answers remain separate from these timestamps.

Choose **Timed section** in a step's type menu and set **Window starts** and **Window ends**, for example 9:15 am–10:25 am. The time period is the section name and updates automatically when either time changes. It checks every response below it until the next Section or Timed section. Instructions are excluded. Moving either section type carries the steps beneath it. The section shows the number completed within the window and a summary. Each response shows **Before window**, **Within window**, **After window**, **Not completed** or **Time unavailable**. A green response still means a valid answer; its separate timing indicator shows whether it met the window. Outside-window answers can still be saved and the checklist completed.

Windows use the record's fixed checklist date in Melbourne, rather than today's date when reviewing. A daily overnight occurrence retains its original day's date; other records use the selected date when first started. An end time earlier than the start continues into the next day. Equal start/end times are invalid. The exact start and end instants are included. Melbourne skipped/repeated clock times follow the same daylight-saving behavior as planners. New windows and step order apply to new records; existing snapshots and completed records are preserved. The live builder preview displays the window without creating records or timestamps.

## Number and selection options

Number entry supports whole numbers, decimals, currency, percentage, temperature, weight, volume, length, duration and custom units. Choose 0–6 decimal places, currency or measurement units, and optional minimum/maximum. Values format when leaving the field and remain numeric in storage. Percentage values are entered as percentage points: enter `28` for `28%`. Durations use the selected seconds/minutes/hours unit. Existing plain number steps retain their original precision until edited.

Selections can be single or multiple. Custom items have one entry per line. Users come from non-pending accounts assigned to the checklist’s location; only names and IDs are exposed. Locations come from the completing user’s accessible locations in the selected company. Selected names are saved on the server with the answers, so later renames or removals do not rewrite completed records. An existing saved selection remains valid when another authorised staff member resumes the same location’s draft.

Existing yes/no, choice, multiple choice, photo, date and time records remain readable and valid. Opening an old template in the editor maps those fields to their corresponding new types for future runs; saved run snapshots stay unchanged.

## Schedules and storage

Dates use Australia/Melbourne. Daily planners have one occurrence per selected date/location. Other recurring planners have one per anchored 7-day, 14-day, month or year interval/location. Legacy weekly planners keep Monday–Sunday periods. One-off planners have one occurrence; On-demand planners permit repeated manual starts, offering an existing draft for resuming.

Future occurrences cannot be started. Earlier dates can be selected for missed occurrences without configured active times; a timed window always uses the server's current clock. Scheduled occurrences appear when viewed and records are created when a new checklist card is opened. Cards update timing indicators and current-window availability every 30 seconds while visible.

The network's data directory contains `ops-management.json` and `ops-management/communication-media/`. Include both in data backups and migrations. File downloads check the current company, location access and checklist permission on every request; they are not public assets. No invoice, sales, stock or expense data is changed by checklist completion.


## Planner schedule breakdown

Plans ends with a light primary-tinted Plan breakdown below the schedule controls. It leads with one plain-language sentence built by `opsPlannerSummary.describe().sentence` (for example “This checklist will start on 25 Jan 2027, available from 1 hour before closing until closing, due the same day at closing, and will repeat every day.”), then tight label/value rows keep the repeat, date, hours and deadline information visible; incomplete/unscheduled feedback replaces the sentence. It updates from the current draft with repeat days, the start date (or an existing saved date range before editing), effective active hours and deadline, using 12-hour times. A later scheduled start is included in the effective opening; overnight finishes are explicitly next-day. Anchored weekly/fortnightly, calendar-week legacy plans, month-end and leap-year repeats retain their native meanings. Invalid/incomplete dates, repeat days or times show feedback instead of stale predictions.

Expand Current and next runs to see up to three current/future possible windows for every selected accessible location. This uses the existing planner period, active-window, hourly and deadline functions with the server-aligned Melbourne clock, exact trading-hour offsets and local DST resolution. Completed windows are excluded; a currently available overnight/hourly window can appear. Hourly finishes are capped to the active finish. Missing/closed trading hours are explicit, and changing location assignments refreshes the preview. Times include timezone abbreviations so repeated DST clock hours stay distinct.

Paused planners show Preview if activated, manual planners show Available start windows and never promise automatic runs, and Unscheduled has no run preview. These are possible start windows, not saved checklist runs or completion predictions. Expanding, switching or reading the breakdown never writes, starts work or calls intelligence. Preview calculations are lazy, bounded and update only when the schedule, selected location hours or clock minute changes; focused fields and the expanded state are preserved. All ordinary autosaving, permissions, audiences and immutable run snapshots remain unchanged.


## One planner per checklist

Each checklist supports one current planner for its recurrence, locations and assignees. A new second planner is rejected inside the native atomic write queue, including concurrent creates and paused planners; retries of the original creation remain idempotent. Older template writers cannot create a parallel legacy plan. The builder uses Plans, a singular planner card and Set up planner only when none exists, without Add planner controls. Internal schedule keys and historical model rules remain compatible.

Older checklists with multiple planners stay read-only in settings until an authorised manager explicitly chooses Keep this planner. The selector is available only for that legacy choice. The server checks every existing planner’s revision and every assigned location before retaining the chosen planner and retiring the others. The retained planner has no end date. Retirement stops new work but preserves original configurations, completed and unfinished run snapshots, audiences and History access; unfinished records can still be completed. Reads do not choose a planner or retire anything. Selection retries are actor/context-bound and do not increment revisions again.

OpStack intelligence produces at most one paused planner. Applying a reviewed draft updates an existing planner in place while preserving its locations and audience, or creates the first planner. The preview explains that applying replacement settings pauses the planner for review. Slow/conflicting changes require reopening the current Plans; stable, actor-bound update tokens coalesce uncertain retries without overwriting later edits. Draft generation creates no work and cannot add hidden end dates.

## Checklist library, inactive and deleted checklists

Checklist builder shows each checklist as a card with its plan status (schedule
type, Plan paused, No plan yet or Inactive), step and location counts and the last
update, filtered by All, Active and Inactive tabs and the search field. Card
actions are Edit/Open and a ⋯ menu for authorised editors.

- **Make inactive / Make active** (`PUT /api/ops-management/templates/:id/status`
  with `status` and the current `revision`) requires `ops.manage`, CSRF and access to
  every location used by the checklist's plans. Inactive checklists stay editable,
  but their plans are treated as paused: no new scheduled cards appear and new
  on-demand starts are refused. Already-started runs remain openable and can be
  finished. Making it active again restores scheduling without editing its plans.
- **Delete** (`status: 'deleted'`) keeps a tombstone (`deletedAt`, `deletedBy`) and
  a `statusHistory` audit. Deleted checklists disappear from the builder, Plans and
  Active, cannot be edited or reactivated through the API, and their run records,
  snapshots, media access and History stay unchanged.
- The builder shows an Inactive banner with Make active, and **Add step** opens a
  picker of every step type with the same defaults the step editor applies.

## Step audiences (locations and permission levels)

Each response or instruction step (not sections) may carry optional `locationIds`
and/or `roleIds`. Omitted means every location / everyone. In the expanded step,
The expanded step keeps one compact row of controls with a single 10 px rhythm:
Step type, **Visible at** (locations) and **Visible to** (permission levels)
multi-select dropdowns using the shared app selector, and a Required switch. A
one-line hint and full-width instructions follow. Blank dropdowns show All
locations / Everyone; a badge in the step header summarises a limit. Phones
stack the row (Visible at/to side by side) with touch-sized controls.

- Saves validate ids against the editor's accessible locations and assignable levels
  (ids already saved on that step are kept); sections cannot be limited and changing
  a step into a section clears its limits.
- **Hide and skip:** a step applies only when the run's location and the viewer's
  permission level both match. Non-matching viewers never see the step in run
  readers, task progress, quick checkbox ticks, History summaries or media, and it
  is not required for them to complete the run. Their answer saves cannot write
  those steps and keep answers others recorded, so people who can see the step
  (for example managers) can still answer it in the same run.
- Limits are part of the template snapshot, so started runs keep the audience they
  started with.

## Step reports

Reporting → Checklist progress has a **By checklist / By step** toggle. By step uses the checklist rows already loaded for the selected dates and locations (no extra reads or writes).

- Choose a checklist (shown with its run count). Each response step the viewer can see is listed under its section, with Done (runs where it was answered ÷ runs that included it), Completion, Usual time (median Melbourne time it was ticked off, from server-recorded step activity), Most done by and Last done.
- Timed sections show their window, e.g. "Timed section · 9:00 am – 11:00 am", and an On time rate: steps completed inside the window ÷ timed steps that are decided (on time, early, late or missed). A step still unanswered after the window ends counts as **missed**; one with no recorded time is "Time not recorded" and is left out of the rate.
- Selecting a step name opens its run-by-run history (work date, location, done, done at, done by, timing). Export CSV in By step exports every step on every run of the chosen checklist, with Melbourne local times.
- Today's unstarted scheduled tasks use the current checklist's steps as not done. Earlier unstarted schedules still cannot be reconstructed.

The server only adds step facts to report rows: step ID/title/type, section, done, completion time and person, and timing state. Answer values, files, photos and signatures are never included, and steps limited to other locations or permission levels are left out for viewers who cannot see them.

## Timed sections and the completion rate

Checklist completion rates treat timed sections as pass/fail. Any step in a timed section that was done **early**, **late**, or not done by the time the window ended (**missed**) is a failed step.

- Each checklist run scores between 0% and 100%. A completed run scores 100% minus its share of failed timed steps (for example, 2 failed out of 5 visible steps = 60%). A run that isn't completed scores the share of its steps answered on time.
- The Completion rate card, Location rankings, the Progress column and the CSV export all use this score, as do scheduled OpStack intelligence report facts. Training keeps its completed ÷ total rate.
- Timed steps still inside their window are not failures yet. A step with no recorded time isn't counted as failed.
- Checklist Location rankings show each shop side by side as a card with its rank, a completion-rate progress ring (green 90% and above, red below 60%) and its name. Cards follow the Rank by choice; shops without matching work show an empty ring and Unranked. Each card has a spoken label with the rate. Training rankings keep their table.

## Rank colours

Every Reporting location ranking (Business overview, Training and the checklist ring cards) uses the same gold, silver and bronze as the Home Sales leaderboard for places 1, 2 and 3. Each gets a medal-coloured place badge (read out as, for example, "Gold · Place 1") and a matching row or card tint. Tied places share a colour, and unranked locations keep the plain style.

## Checklist logic

Checklist steps can use logic, set in each step's options under **Logic** (Ops checklists only; in-store training is unchanged). The shared `public/ops-step-logic.js` model is used by the server, the run reader, the builder's phone preview and reports.

- **Yes / No / N/A** (`yes-no-na`) is a quick three-answer step. N/A is a complete answer and never fails. The older `yesno` type still converts to a selection step as before.
- **Show this step** (`showWhen`) shows a step only when an earlier step matches a rule:
  - a checkbox is or isn't ticked
  - a Yes / No / N/A or custom selection answer is or isn't a value
  - a number is below or above a value
  - any step with a pass/fail check fails or passes

  Rules can chain. A step is hidden whenever its source step is hidden, missing, after it, or not visible to that person. Hidden steps aren't required, don't count in progress and are left out of reports. Answers already saved on them are kept.
- **Pass/fail check** (`passRule`) can be set on these steps:
  - Yes / No / N/A: which answer passes
  - number: lowest and/or highest passing value, inclusive
  - custom selection: the passing items

  Failed answers are marked Failed in the checklist. In Reporting they count as failed steps in the completion rate, the same as timed-section misses, and appear in the Passed column, the step history Result column and the CSV.
- **If it fails, require** (`failAction`) asks for a note and/or a photo explaining the corrective action. Notes (up to 1000 characters) and photos (up to 5, images only) are saved in `run.actions`, separately from answers. They use the run's existing media audience and can't be completed without. Completed records show them read-only.
- The builder clears rules that no longer fit before saving, for example when the source step is deleted, moved below the step or changes type. The server rejects invalid rules. Checklists with logic don't offer the one-tap quick tick.

## Builder shortcuts and auto-collapse

- Click anywhere on a step's header (not its controls) to open or close it. Adding a step closes the others so only the new step is open.
- **Copy step** duplicates a step directly after it. Copying a section copies its steps too. Copies get new IDs, and show-when rules inside the copied block point at the copies.
- Dragging gives faster feedback: moves animate in 90 ms, and autoscroll near the screen edge is quicker.
- **Collapse steps once they're done while filling in** (`autoCollapse`) is a checklist setting. It's kept when older writers omit it, and copied into each new run's snapshot, so started runs keep the value they began with. In the reader, a finished response step (answered, with any corrective action recorded) shrinks to its heading once focus leaves it. Tapping the heading, or pressing Enter/Space, reopens it and it stays open. This is display-only and never saves answers.
- **Start collapsed** is a per-section option (sections and timed sections, Ops checklists only) saved as `collapsed: true` on the section step; the server keeps it only on section types, stores nothing for off, and runs copy it in their snapshot. In the reader (and the builder's phone preview) every section heading that has steps under it is a toggle that opens or closes those steps (up to the next section); Start collapsed sections begin closed, others begin open. The heading shows a done/total count of its visible response steps (green once all are done). Tapping the heading or pressing Enter/Space opens or closes it. This is display-only: it never saves answers or changes what must be completed.

## Camera-only photo and video steps

Photo / video steps (and corrective-action photos on failed checks) are captured with the device camera, not uploaded from files:

- **Take photo** and **Record video** open the camera in the app (`public/camera-capture.js`). You can switch between front and back cameras, retake, then choose **Use photo** or **Use video**. Videos are capped at 60 seconds and 25 MB. Allowed media (photos, videos or both) decides which buttons appear. The camera takes over the full screen on every device (the app's top bar and phone tabs hide while it is open and return on close), keeps its controls on screen whatever the camera's picture shape, and uses phone-camera style controls: a round centre shutter (a red disc for video that becomes a square while recording), a round switch-camera button, and Retake / Use photo icon buttons.
- If the browser can't open the camera in the app, phones fall back to their own camera screen. Computers without a camera show a note to use a phone or tablet. There's no file picker for these steps.
- File submission steps still accept uploaded files as before.
- Captured files go through the same run media upload, size checks and private media access as before.

## Button steps

Add step → **Buttons** offers ready-made steps answered with one tap:

| Picker entry | Buttons | Preset pass rule |
| --- | --- | --- |
| Completed without having to interfere | Yes · No (title prefilled) | Yes passes |
| They Know What It is | Yes · No (title prefilled) | Yes passes |
| Number rating (1 to 5 / 10 / 20) | 1 … 5 / 10 / 20 | — |
| Yes, No | Yes · No | — |
| Yes, No, N/A | the existing Yes / No / N/A step | — |
| Pass, Fail | Pass · Fail | Pass passes |
| Compliant, Not Compliant | Compliant · Not compliant | Compliant passes |
| Satisfaction | Very dissatisfied … Very satisfied (faces) | — |

Each entry (from `opsStepModel.buttonSets`) is its own step type: it appears by name in the step's **Step type** dropdown and lists its buttons in the step options. Steps are saved as `{type: 'buttons', buttons: '<preset id>', options}`; the server always takes the buttons from the catalogue (ignoring any sent by the browser), rejects unknown ids and accepts only one of those buttons as an answer. Presets that start with a pass rule can have it changed or removed under Logic. Button steps saved earlier as Selection steps with a button style keep working and open as the matching button type. A plain custom, single-choice Selection can still turn on **Show as buttons**. The checklist reader and phone preview draw these as radio-backed buttons: ratings as a number grid (up to ten per row, five on phones), Satisfaction with faces, and answers with a pass rule turning green or red when chosen. Tapping the chosen button again clears an optional step. Answers, show-when rules, pass rules, corrective actions, autosave, History and reports behave exactly as for Selection steps. The Yes / No / N/A step uses the same button look.

## Scored checklists

Turn on **Score this checklist** (beside Collapse steps) to add up button answers. It is a saved checklist setting (`scoring`) that older writers keep when they omit it, and new runs freeze it in their snapshot.

| Step | Points |
| --- | --- |
| Completed without having to interfere, They Know What It is, Yes/No | Yes 1 · No 0 |
| Pass/Fail | Pass 1 · Fail 0 |
| Compliant/Not Compliant | Compliant 1 · Not compliant 0 |
| Number rating 1–5 / 1–10 / 1–20 | the number chosen |
| Satisfaction | Very dissatisfied 1 … Very satisfied 5 |
| Yes / No / N/A | Yes 1 · No 0 · N/A left out of the total and maximum |

These are defaults. Each button step (and Yes / No / N/A) has a **Score points** box in its step options with one number per button (from -1000 to 1000, up to two decimal places, negatives allowed); **Reset** restores the defaults, and switching to another button type resets them to that type's defaults. The server checks there is one valid number per button, saves them on the step (`points`) and new runs freeze them, so changing points never alters past results.

The total is points ÷ the highest possible points of every scored step the person can see. Steps hidden by show-when rules are left out. Unanswered steps add nothing but still count toward the maximum, so the score only reaches 100% when every scored step gets its best answer. Button steps save their points with the step (`points`), so later changes to the catalogue don't change old runs. `opsStepLogic.score` is shared by the reader, the server's run summaries, History and Reporting. The run reader shows **Score points / max · %** beside the progress count and updates as answers change. History cards show the same badge, and Reporting → Checklist progress adds it under the progress figure and as Score, Score max and Score % columns in the CSV. Scores are always worked out from saved answers and are never stored separately.

### Step options layout

A step's options keep logic together in one compact **Logic** panel. **Score points** comes first, with each button's name joined to its points box and a small Reset. Show this step and its dropdown sit on one line. Passing items and **If it fails, require** are tappable chips, side by side on wide screens. All logic styling uses the fixed OpStack gradient (teal → indigo → violet), the same for every company rather than the company colour: the panel border and label, chosen chips, score chips, the Conditional / Pass/fail badge on each step's header, and the reader's "Passes when…" hints. Forced-colour mode falls back to system colours.

Logic is opt-in per step. A step with no show-when rule, pass rule, corrective action or changed score points shows only an **Add logic** button; pressing it opens the Logic panel for that step without saving anything. Steps that already use logic (including Pass/Fail-style button steps, which start with a pass rule) show the panel straight away. **Remove logic** clears the step's show-when rule, pass rule and corrective actions, puts score points back to their defaults and returns the step to Add logic.


## Phone preview size

The Checklist builder's phone preview is a fixed panel on the right. The iPhone frame and its 402 × 874 screen (a same-origin iframe that lays out at real phone width) scale together as one picture to the largest size that fits the window height without scrolling, up to 100%, while leaving the builder at least 520 px. The panel width, the reserved space beside the headings and toolbar (`--preview-width`, `--ops-preview-reserve`) and the "shown at N%" label follow that scale. Collapsing still narrows it to the 42 px rail.

## Step notes

Staff can add notes to any response step while filling in a checklist. The note icon in the step's heading (named **Add note** for screen readers and on hover, or **Notes (n)** once there are notes) opens a text box under the step with a tick and × inside it; the tick (or Ctrl/Cmd+Enter) saves it and folds it into the icon, which then shows a count. Tapping the icon again opens a small list of that step's notes where each note can be edited (pencil) or deleted (bin), and **+ Add note** adds another. Escape, an outside tap or × closes the list without closing the checklist. Plain text steps don't show the icon unless they already have notes.

- Notes are kept separately from answers in `run.notes` as `{stepId: [{id, note, by, byId, at, editedAt?, editedBy?}]}` and save through the normal automatic save. Each save sends the full list for the steps that changed; steps it leaves out keep their notes.
- Up to 20 notes per step and 1,000 characters each; surrounding spaces are trimmed and blank notes are rejected (delete them instead).
- The server records who wrote each note and when. Only the author or someone with checklist management (`ops.manage`) can edit or delete a note; edits keep the original author/time and add `editedAt`/`editedBy`.
- Notes on steps limited to other locations/permission levels are kept and never shown to people who can't see the step. Section, instruction and unknown steps are rejected, and notes can't change after the checklist is completed. Older single notes read as a one-item list.
- Notes are not answers: they don't complete a step, change scores or pass rules, or appear in list/History summaries. Completed runs and History show the list read-only through the same icon, and the printable run (Logs and PDF export) includes them.

## Compact run steps

In the checklist reader each response step is kept short. The step title stays on its own line, with any help text underneath. The pass-rule hint (such as Passes when Yes), tick-box answers and the Saved/timing line share the next line, and the Saved/timing line is hidden when there is nothing to show. Larger answers such as buttons, number fields and photos follow on their own line, then notes and corrective actions. Option and button labels have no extra top margin, and cards use tighter padding and spacing. On desktop with a mouse, button choices are 34 px tall; phones and touch screens keep their larger touch sizes and satisfaction faces keep their size. This is styling only.

## Active checklist cards

Checklist cards show their details as small icons: how often it repeats (a clock for hourly, sun for daily, calendar for weekly/fortnightly/monthly, star for yearly, play for on-demand), its status (empty circle to do, half-filled in progress, green tick completed, red cross missed) and any priority (flag for high, warning triangle for urgent). Hovering or long-pressing an icon shows its name, and screen readers still read the words. Opens at…, Due soon and Overdue keep their text with an icon, and the location and due date have pin and calendar icons. Progress is a thin vertical bar on the right of the card that fills from the bottom (green once completed); the steps count and percentage stay at the bottom. This is display only.

Cards that are due soon have an orange tinted fill and border, and overdue cards a red one, in the same style as the green completed cards. They follow the card's live Due soon / Overdue badge, so the colour changes on its own as the time passes, and completed checklists stay green.
