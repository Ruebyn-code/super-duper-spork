# Ops management

Open **Ops management** from the main navigation, or **More → Ops management** on a phone. A company has one checklist library; switching the selected company changes the library. The location filter can show all locations the user can access in that company.

Head Office and Franchisees can create templates by default. All signed-in staff can complete them. Settings → Permission levels has separate **View**, **Complete** and **Manage checklists** controls. Existing customised roles keep their grants; grant these controls explicitly where needed.

## Create a checklist

1. Select **New checklist**, enter its name and instructions, and tick its assigned locations.
2. Choose Manual, One-off, Daily or Weekly, then set the start date. Daily and weekly schedules can have an end date; weekly schedules have a due day.
3. Add and reorder steps. Each step has a title, optional instructions and a required toggle. Types: tick box, short answer, long answer, number, yes/no, single choice, multiple choice, photo, date, time, typed signature, and instruction.
4. Number steps support a unit and optional minimum/maximum. Choice steps have one option per line. Instruction steps require no response.
5. Save. Use Templates to edit or pause an existing checklist. Pausing stops new starts without deleting records.

Managers can assign only locations they can access. Editing a shared template requires access to every assigned location; a manager with access to just some locations can still complete its assigned checklists.

## Complete and review

Checklists shows the occurrences for the selected date and locations. Start or resume a checklist, enter answers, and **Save progress** or **Complete checklist**. Progress is shared within its location. Completion validates required steps and number limits. Photos support PNG/JPG/GIF/WebP up to 10 MB. A signature step records a typed name alongside the signed-in user's completion attribution and timestamp.

History retains drafts and completed records with location, author, timestamps, answers and the original template version. Completed records are read-only. Edits to a template affect new records, not existing drafts or completed checklists. Concurrent saves use revisions; reload saved progress before retrying a conflicting change.

## Schedules and storage

Dates use Australia/Melbourne. A daily schedule has one record per date/location; a weekly schedule has one record per Monday–Sunday week/location. The weekly due day is a deadline, and the checklist is available from the start of that week or its configured start date. A one-off checklist stays available from its start date until completed. Manual checklists can be started repeatedly; an existing manual draft is offered for resuming. Future occurrences cannot be started. Earlier dates can be selected to complete a missed occurrence. Scheduled occurrences appear when viewed; records are created on Start, without a background job or notification service.

The network's data directory contains `ops-management.json` and `ops-management/communication-media/`. Include both in data backups and migrations. Photo downloads check the current company, location access and checklist permission on every request; they are not public assets. No invoice, sales, stock or expense data is changed by checklist completion.
