# Ops management

Open **Ops management** from the main navigation, or **More → Ops management** on a phone. A company has one checklist library; switching the selected company changes the library. The location filter can show all locations the user can access in that company.

Head Office and Franchisees can create templates by default. All signed-in staff can complete them. Settings → Permission levels has separate **View**, **Complete** and **Manage checklists** controls. Existing customised roles keep their grants; grant these controls explicitly where needed.

## Two-stage checklist builder

Open **Checklist builder → New checklist** or **Edit checklist** on an existing card. Enter the name and instructions, then add its compact step cards. Open a step's chevron for its type/options and drag its grip to rearrange. Arrow keys move a focused grip; Escape cancels a drag. Moving a section carries the following steps until the next section.

The builder has two stages inside the selected checklist: **1 Checklist** for the name, instructions and steps, and **2 Planner** for configuration. Use the stage buttons or **Continue to planner** to switch. Pending content saves before entering Planner; incomplete or invalid content stays in Checklist with an error. Switching back retains the same fields, step order and open step options.

The **Planner** stage contains three settings groups: **Planners**, **Locations** and **Assignees**. Clicking a group opens its popup; there is no separate planner page in the sidebar. Changes save automatically. Closing the popup returns to the Planner stage, preserving the checklist content and focus. **Back to checklist** returns to the first stage; **Done** in Planner returns to the checklist list.

On a computer, a live **iPhone 18 Pro–style phone preview** sits to the right of both stages. The preview panel keeps its original 340 px width. The phone fills the available width inside it with minimal surrounding space and uses the supplied phone-frame reference with metallic edges and its camera cutout. The builder has compact headings, a single toolbar for the stage buttons and Back, shorter input rows and denser step cards. The preview starts at the top of the desktop content area, preserving its previous lower edge. The phone is centred and maximised within that width and height so the full frame remains visible, including on shorter laptops; the checklist content scrolls inside the phone. The preview stays fixed beside the editor when the step list scrolls. It uses the checklist’s mobile field layout, required markers, descriptions, number formats, media controls and signature fields. It reflects draft edits and step order without creating records, saving answers or uploading files. Collapse/expand it with the phone icon; that choice is remembered for the signed-in account and company in this browser. The preview stays hidden on tablets and phones.

Each checklist can retain several planners, such as morning and evening checks. Choose the planner at the top of the popup when there is more than one, or use **Add planner** inside it. All three groups edit that selected planner. Its locations and permission audience are independent of the other planners. New configurations start as Unscheduled until you choose how the team should use them.

Managers can create content for their selected company. Editing shared content requires access to every location used by any planner, including paused planners. Managers with partial location access can open the checklist with its content read-only and configure planners covering only their own accessible locations. A shared planner requires access to all of its assigned locations before it can be edited.

## Planners group

The compact **Set schedule** popup uses four checklist-type cards, a single recurrence row, three-column timing fields on desktop, and a short schedule summary. Dates, active hours, due time/day, reminders and priority stay visible together; phones use a two-column layout with scrolling when needed. Selected cards use the company primary colour.

Choose:

- **Checklist type**: **Recurring** repeats on a schedule; **On-demand** can be started manually and repeatedly; **Once off** has one occurrence per location; **Unscheduled** keeps the configuration out of the team's checklist list.
- **When it happens** for recurring checklists: Daily, Weekly, Fortnightly, Monthly or Yearly. Daily can use selected weekdays. New weekly and fortnightly schedules repeat from the configured start date, every 7 or 14 days. Monthly schedules retain the start day, clamping to the final day of shorter months; yearly schedules similarly clamp a 29 February anniversary to 28 February in non-leap years.
- **Start date** and **Checklist start time**: an occurrence becomes available from its first scheduled day/time. Start time belongs to the chosen recurrence, rather than changing the date anchor each day. An optional end date stops new occurrences.
- **Due time** and **Due day**: choose the day relative to the start, including Next day for an overnight deadline. Existing weekly schedules retain their original calendar-week identity and due day when unrelated settings are edited.
- **Active from / Active until**: daily opening and closing hours for new starts. Blank opening uses the checklist start time, or midnight. A closing time before opening continues overnight. Leave both blank for no daily hour restriction; the scheduled start time still applies. The server uses its Melbourne clock and rejects attempts to bypass a window by selecting an earlier date. Work already started remains available to finish after the window closes.
- Optional **In-app reminder**, **Priority**, **Planner instructions** and **Active planner**. Reminders mark incomplete cards Due soon before the deadline and Overdue after it, while Ops management is open; no background emails or push notifications are sent. Pausing stops new occurrences without deleting records.

The preview shows upcoming dates. Melbourne daylight-saving gaps move a skipped time to the first real minute after it; repeated clock times use the later occurrence. Daily overnight windows retain the previous day's occurrence after midnight until closing.

## Locations group

Choose the locations using this planner. Only accessible locations in the selected company can be added. Existing assignments outside a manager's access are never silently removed. Users still need current location access to view, start, save or upload to its checklists.

## Assignees group

Use **All permission levels**, or choose specific levels. The choices include network levels and the selected company's overrides/custom levels. Selection does not grant application permissions: users also need checklist view/complete grants and access to the location.

The audience is checked on the server for tasks, starts, history, record reads/writes and private uploads/downloads. Changes take effect on subsequent requests, including existing records. Management access permits configuring settings; it does not bypass an excluded permission audience for checklist records. Roles are stored by stable ID so renaming a level does not break the assignment. A removed level remains unavailable and cannot grant access.

## Existing data

Legacy assignments and schedules continue to use stable planner IDs. Editing grouped settings does not recreate a planner or rewrite an existing checklist snapshot. Scheduled starts are deduplicated by planner, location and period; separate planners using the same content keep independent answers.

New content and timing edits affect new records. Drafts and completed records retain their original instructions, due information and revision snapshots. Current location and assignee restrictions still apply. Completed records stay read-only. Backups continue to include the same data file and private media directory.

## Complete and review

The active view has a day heading and location selector, a previous/next-day strip with a live Melbourne clock, and search, sorting and filters. It initially selects the current app location; All locations remains available within the user’s accessible locations. Dates cannot advance past today. Sort by status, due time, priority or name, and filter by status or priority. Run on-demand opens an authorised existing checklist for the selected date/location without creating a new template. Checklists shows a dense grid of narrow cards, with two cards side by side on typical phones. The phone bottom bar’s Checklists icon opens this active view. Phone users open Checklist builder and History through More; the local sidebar remains on larger screens. Create checklists through Checklist builder; the active view does not show a New checklist action. Click or tap anywhere on a card to start, resume or review it; keyboard users can focus the card and press Enter or Space. Each card shows saved response progress, excluding sections and instructions. Completed cards turn green and show a full progress bar, including checklists with optional unanswered steps. A fully answered draft stays in progress until explicitly completed. New starts still respect active windows and completion permissions. Opening a checklist shows a desktop popup. On tablets and phones it fills the app viewport and hides the shared navigation until closed. The same form and draft stay in place when resizing or rotating.

Valid answered steps turn green immediately, with a check mark and an answered/total progress counter. Clearing an answer or entering an invalid number removes the green state. Zero and a “No” answer count as valid answers. Sections and instructions do not count toward the response total. Green indicates a valid local answer. Progress saves automatically after a short typing pause, without refreshing the fields. **Complete checklist** remains a separate action. Closing flushes pending changes; invalid entries and failed saves remain visibly unsaved, and closing asks before discarding them. Active uploads must finish first. **Retry save** retries a failed draft save; revision conflicts require reloading saved progress so another person’s changes are not overwritten. Progress is shared within its location. Completion validates required steps, number precision and limits, selection access and uploaded files. Photo/video and file steps allow 1–10 submissions. Photos and other files support up to 10 MB each; MP4, WebM and MOV videos support up to 25 MB each. Supported documents include PDF, Office documents, text, CSV and ZIP; audio uploads are also supported. Videos preview inside the checklist and support seeking.

Signature steps can require a drawn signature, a typed name, or either method. Drawings are private PNG files saved with the entered signer name and the signed-in user’s completion attribution and timestamp. Date and time steps can collect a date, time, or both, using Melbourne wall-clock values.

History retains drafts and completed records with location, author, timestamps, answers and the original template version. Completed records are read-only. Edits to a template affect new records, not existing drafts or completed checklists. Concurrent saves use revisions; reload saved progress before retrying a conflicting change.

## Number and selection options

Number entry supports whole numbers, decimals, currency, percentage, temperature, weight, volume, length, duration and custom units. Choose 0–6 decimal places, currency or measurement units, and optional minimum/maximum. Values format when leaving the field and remain numeric in storage. Percentage values are entered as percentage points: enter `28` for `28%`. Durations use the selected seconds/minutes/hours unit. Existing plain number steps retain their original precision until edited.

Selections can be single or multiple. Custom items have one entry per line. Users come from non-pending accounts assigned to the checklist’s location; only names and IDs are exposed. Locations come from the completing user’s accessible locations in the selected company. Selected names are saved on the server with the answers, so later renames or removals do not rewrite completed records. An existing saved selection remains valid when another authorised staff member resumes the same location’s draft.

Existing yes/no, choice, multiple choice, photo, date and time records remain readable and valid. Opening an old template in the editor maps those fields to their corresponding new types for future runs; saved run snapshots stay unchanged.

## Schedules and storage

Dates use Australia/Melbourne. Daily planners have one occurrence per selected date/location. Other recurring planners have one per anchored 7-day, 14-day, month or year interval/location. Legacy weekly planners keep Monday–Sunday periods. One-off planners have one occurrence; On-demand planners permit repeated manual starts, offering an existing draft for resuming.

Future occurrences cannot be started. Earlier dates can be selected for missed occurrences without configured active times; a timed window always uses the server's current clock. Scheduled occurrences appear when viewed and records are created when a new checklist card is opened. Cards update timing indicators and current-window availability every 30 seconds while visible.

The network's data directory contains `ops-management.json` and `ops-management/communication-media/`. Include both in data backups and migrations. File downloads check the current company, location access and checklist permission on every request; they are not public assets. No invoice, sales, stock or expense data is changed by checklist completion.
