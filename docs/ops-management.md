# Ops management

Open **Ops management** from the main navigation, or **More → Ops management** on a phone. A company has one checklist library; switching the selected company changes the library. The location filter can show all locations the user can access in that company.

Head Office and Franchisees can create templates by default. All signed-in staff can complete them. Settings → Permission levels has separate **View**, **Complete** and **Manage checklists** controls. Existing customised roles keep their grants; grant these controls explicitly where needed.

## Create a checklist

1. Select **New checklist**, enter its name and instructions, and tick its assigned locations.
2. Choose Manual, One-off, Daily or Weekly, then set the start date. Daily and weekly schedules can have an end date; weekly schedules have a due day.
3. Add compact step cards. Edit titles directly, open the chevron to choose a step type and its options, and drag a grip to rearrange. Arrow keys on a focused grip move steps too; Escape cancels dragging. Moving a section carries its following steps until the next section.
4. Choose Checkbox, Photo / video, File submission, Short text, Long text, Number entry, Selection, Signature, Date and time, Section, or Instruction. Sections and instructions require no response.
5. Save. Use Templates to edit or pause an existing checklist. Pausing stops new starts without deleting records.

Managers can assign only locations they can access. Editing a shared template requires access to every assigned location; a manager with access to just some locations can still complete its assigned checklists.

## Complete and review

Checklists shows the occurrences for the selected date and locations. Starting, resuming or reviewing a checklist opens a desktop popup. On tablets and phones it fills the app viewport and hides the shared navigation until closed. The same form and draft stay in place when resizing or rotating.

Valid answered steps turn green immediately, with a check mark and an answered/total progress counter. Clearing an answer or entering an invalid number removes the green state. Zero and a “No” answer count as valid answers. Sections and instructions do not count toward the response total. Green indicates a valid local answer; use **Save progress** or **Complete checklist** to save it. Closing asks before discarding unsaved progress, and waits for active saves or uploads. Progress is shared within its location. Completion validates required steps, number precision and limits, selection access and uploaded files. Photo/video and file steps allow 1–10 submissions. Photos and other files support up to 10 MB each; MP4, WebM and MOV videos support up to 25 MB each. Supported documents include PDF, Office documents, text, CSV and ZIP; audio uploads are also supported. Videos preview inside the checklist and support seeking.

Signature steps can require a drawn signature, a typed name, or either method. Drawings are private PNG files saved with the entered signer name and the signed-in user’s completion attribution and timestamp. Date and time steps can collect a date, time, or both, using Melbourne wall-clock values.

History retains drafts and completed records with location, author, timestamps, answers and the original template version. Completed records are read-only. Edits to a template affect new records, not existing drafts or completed checklists. Concurrent saves use revisions; reload saved progress before retrying a conflicting change.

## Number and selection options

Number entry supports whole numbers, decimals, currency, percentage, temperature, weight, volume, length, duration and custom units. Choose 0–6 decimal places, currency or measurement units, and optional minimum/maximum. Values format when leaving the field and remain numeric in storage. Percentage values are entered as percentage points: enter `28` for `28%`. Durations use the selected seconds/minutes/hours unit. Existing plain number steps retain their original precision until edited.

Selections can be single or multiple. Custom items have one entry per line. Users come from non-pending accounts assigned to the checklist’s location; only names and IDs are exposed. Locations come from the completing user’s accessible locations in the selected company. Selected names are saved on the server with the answers, so later renames or removals do not rewrite completed records. An existing saved selection remains valid when another authorised staff member resumes the same location’s draft.

Existing yes/no, choice, multiple choice, photo, date and time records remain readable and valid. Opening an old template in the editor maps those fields to their corresponding new types for future runs; saved run snapshots stay unchanged.

## Schedules and storage

Dates use Australia/Melbourne. A daily schedule has one record per date/location; a weekly schedule has one record per Monday–Sunday week/location. The weekly due day is a deadline, and the checklist is available from the start of that week or its configured start date. A one-off checklist stays available from its start date until completed. Manual checklists can be started repeatedly; an existing manual draft is offered for resuming. Future occurrences cannot be started. Earlier dates can be selected to complete a missed occurrence. Scheduled occurrences appear when viewed; records are created on Start, without a background job or notification service.

The network's data directory contains `ops-management.json` and `ops-management/communication-media/`. Include both in data backups and migrations. File downloads check the current company, location access and checklist permission on every request; they are not public assets. No invoice, sales, stock or expense data is changed by checklist completion.
