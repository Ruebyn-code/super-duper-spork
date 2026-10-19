# Ops management

Open **Ops management** from the main navigation, or **More → Ops management** on a phone. A company has one checklist library; switching the selected company changes the library. The location filter can show all locations the user can access in that company.

Head Office and Franchisees can create templates by default. All signed-in staff can complete them. Settings → Permission levels has separate **View**, **Complete** and **Manage checklists** controls. Existing customised roles keep their grants; grant these controls explicitly where needed.

## Checklist builder

Checklist builder contains the reusable content: its name, instructions and step cards. Locations and scheduling are managed separately in **Planners**.

1. Open **Checklist builder → New checklist**. Enter a name and instructions.
2. Add compact step cards. Edit titles directly, open the chevron to choose a step type and its options, and drag a grip to rearrange. Arrow keys on a focused grip move steps too; Escape cancels dragging. Moving a section carries its following steps until the next section.
3. Choose Checkbox, Photo / video, File submission, Short text, Long text, Number entry, Selection, Signature, Date and time, Section, or Instruction. Sections and instructions require no response.
4. Valid changes save automatically. **Done** returns to the builder list. **Plan this checklist** opens a new planner for the saved content. A checklist without a planner does not appear in the team's due checklists.

Managers can create reusable content for their selected company. Editing content used by planners requires access to every assigned location, including paused planners. A manager with access to only some locations can complete its checklists and create a separate planner for locations they can access, without changing the shared content.

## Planners

A planner chooses where and when a saved checklist is used. One checklist can have multiple planners: for example, Morning checks and Evening checks can use the same content while keeping their completion records separate.

Open **Planners → New planner**, or choose **Create planner** on a builder card. Set:

- **Planner name** and **Checklist**.
- **Locations**: one or more accessible locations in the selected company.
- **Repeat**: Manual, One-off, Daily / selected days, or Weekly. Daily planners can use any combination of Monday–Sunday. Weekly planners have one due day within each Monday–Sunday week.
- **Start date** and an optional **End date** for recurring planners.
- Optional **Due by** time and **In-app reminder**. A reminder marks incomplete checklist cards **Due soon** before the deadline; they become **Overdue** after it. Reminders update while Ops management is open and do not send emails, push notifications or background alerts. A due time is required for reminders. Manual planners have no deadline or reminder.
- **Priority**: Normal, High or Urgent. Higher-priority checklists appear first.
- Optional **Location instructions**, shown when someone opens the checklist alongside its company instructions.
- **Active planner**: pause/resume new occurrences without deleting saved history.

The preview shows upcoming dates before saving. Valid edits save automatically; use **Done** to return to the list. Managers need access to every existing assigned location before editing a planner, and can add only locations they can access. A planner's checklist cannot be changed after records have started; create another planner for different content.

Schedule and content edits affect new records. Existing drafts and completed records retain their original content, planner instructions, due information and revision snapshots. Starting or retrying a scheduled occurrence cannot create duplicate records for the same planner, location and period.

Existing checklist assignments and schedules automatically appear as one planner per former template. The legacy planner keeps the original template ID, so existing drafts, completed records, private uploads and scheduled occurrence identity remain intact. The conversion is deterministic on read and is persisted atomically with the next checklist/planner write.

## Complete and review

Checklists shows the occurrences for the selected date and locations. Starting, resuming or reviewing a checklist opens a desktop popup. On tablets and phones it fills the app viewport and hides the shared navigation until closed. The same form and draft stay in place when resizing or rotating.

Valid answered steps turn green immediately, with a check mark and an answered/total progress counter. Clearing an answer or entering an invalid number removes the green state. Zero and a “No” answer count as valid answers. Sections and instructions do not count toward the response total. Green indicates a valid local answer. Progress saves automatically after a short typing pause, without refreshing the fields. **Complete checklist** remains a separate action. Closing flushes pending changes; invalid entries and failed saves remain visibly unsaved, and closing asks before discarding them. Active uploads must finish first. **Retry save** retries a failed draft save; revision conflicts require reloading saved progress so another person’s changes are not overwritten. Progress is shared within its location. Completion validates required steps, number precision and limits, selection access and uploaded files. Photo/video and file steps allow 1–10 submissions. Photos and other files support up to 10 MB each; MP4, WebM and MOV videos support up to 25 MB each. Supported documents include PDF, Office documents, text, CSV and ZIP; audio uploads are also supported. Videos preview inside the checklist and support seeking.

Signature steps can require a drawn signature, a typed name, or either method. Drawings are private PNG files saved with the entered signer name and the signed-in user’s completion attribution and timestamp. Date and time steps can collect a date, time, or both, using Melbourne wall-clock values.

History retains drafts and completed records with location, author, timestamps, answers and the original template version. Completed records are read-only. Edits to a template affect new records, not existing drafts or completed checklists. Concurrent saves use revisions; reload saved progress before retrying a conflicting change.

## Number and selection options

Number entry supports whole numbers, decimals, currency, percentage, temperature, weight, volume, length, duration and custom units. Choose 0–6 decimal places, currency or measurement units, and optional minimum/maximum. Values format when leaving the field and remain numeric in storage. Percentage values are entered as percentage points: enter `28` for `28%`. Durations use the selected seconds/minutes/hours unit. Existing plain number steps retain their original precision until edited.

Selections can be single or multiple. Custom items have one entry per line. Users come from non-pending accounts assigned to the checklist’s location; only names and IDs are exposed. Locations come from the completing user’s accessible locations in the selected company. Selected names are saved on the server with the answers, so later renames or removals do not rewrite completed records. An existing saved selection remains valid when another authorised staff member resumes the same location’s draft.

Existing yes/no, choice, multiple choice, photo, date and time records remain readable and valid. Opening an old template in the editor maps those fields to their corresponding new types for future runs; saved run snapshots stay unchanged.

## Schedules and storage

Dates use Australia/Melbourne. Each planner has its own records: a daily schedule has one per selected date/location; a weekly schedule has one per Monday–Sunday week/location. The weekly due day is a deadline, and the checklist is available from the start of that week or its configured start date. The first partial week never has a deadline before its start date. End-of-day deadlines use Melbourne time. During daylight-saving changes, repeated due times use the later occurrence and skipped times move to the first real minute after the requested time. A one-off checklist stays available from its start date until completed. Manual checklists can be started repeatedly; an existing manual draft is offered for resuming. Future occurrences cannot be started. Earlier dates can be selected to complete a missed occurrence. Scheduled occurrences appear when viewed; records are created on Start, without a background job or notification service. Checklist cards update due-soon/overdue indicators every 30 seconds while the page is visible.

The network's data directory contains `ops-management.json` and `ops-management/communication-media/`. Include both in data backups and migrations. File downloads check the current company, location access and checklist permission on every request; they are not public assets. No invoice, sales, stock or expense data is changed by checklist completion.
