# In-store training

Learning centre → In-store training schedules practical sessions separately from online course versions and quiz results. A session fixes its location, trainer, named staff, skills, Melbourne date/start time and 5–480 minute duration. Managers need `learning.assign`; candidates must currently belong to the company and location, have Learning centre access, and staff need `learning.complete`. An appointed trainer needs the optional `learning.signoff` action, which inherits `learning.view` and can be denied explicitly in Permission levels. The action does not permit scheduling or assessment of arbitrary sessions. Managers also need it to override the appointed trainer. Nobody can assess themselves.

Staff see only their own practical progress and notes. Appointed trainers see their session’s staff; training assignment managers and training report viewers can review sessions within current location access. Kiosks stay at their pinned location. Every write rechecks current staff roles and membership inside the storage queue; removed trainers and staff cannot continue assessments. APIs inherit normal sign-in, required Comms reading, company context and CSRF enforcement from Learning centre.

Only explicit Create session, Save assessment or Cancel session actions write records. Reads never enrol or complete work. Assessments cannot be saved before the scheduled start. Partial assessments record the checked skills and notes; the final explicit save records completion and assessor attribution. Completed records are immutable. Cancellation prevents further assessments and preserves earlier sign-offs. Dates use the existing Melbourne planner conversion, reject nonexistent DST clock times and use the later repeated time consistently with planners.

`in-store-training.json` is a private atomic file in the existing persistent data directory, using a shared per-file mutation queue. Session creation, assessments and cancellation have actor-bound idempotent request references. Assessment revisions are per staff member so different learners can be assessed independently, while conflicting edits to one learner fail. Private request snapshots retain the assessment history; API DTOs never return fingerprints or raw audit records. Older online courses, assignments, quiz answers and their reports remain unchanged. Practical summaries and filtering are on the In-store training page.

The shared left navigation reuses the new `#in-store` Learning centre view. Scheduling and assessment use bounded native dialogs with explicit saves, disabled pending controls, stable retry references after uncertain responses, unsaved-change guards and restored opener focus. The shared Help icon opens written, picture and video instructions. No operational email, message, AI call or automatic roster entry is created.

Run `node --test in-store-training.test.js detailed-permissions.test.js learning-centre.test.js`, then the full suite. Check desktop/phone session creation, partial progress, reopening, final sign-off, staff privacy, trainer action limits, conflicts, DST, company/location/kiosk scope, draft guards and lost-response retries. Capture only isolated demo data for guide media and build/start the production image before pushing.

## Training checklists and embedded courses

Training managers (`learning.assign`) build reusable **training checklists** under In-store training → Training checklists. The builder reuses the Ops checklist step editor (`public/ops-step-editor.js` with its `kinds`, `selectionSources` and `extraDetails` options) limited to Checkbox, Short/Long text, Number entry, custom-item Selection, Section, Instruction and **Course** steps. Saves are explicit, revision-checked and use actor-bound request references; archiving keeps scheduled sessions intact. Checklists live in the same private `in-store-training.json` (`templates`), scoped to the company.

Training checklists have an optional **Automatically assign linked courses** setting (`assignCourses`, on by default for new checklists; older writers that omit it keep the saved value). When creating a session from a checklist with Course steps, the dialog offers the same choice, defaulting to the checklist's setting; the session saves `assignCourses: true` when chosen. After the session is created, Learning centre adds one ordinary required assignment per linked course for the attending staff at the session location, due on the session date and marked with a private `source` (`in-store`, session ID and title; the DTO shows only the title). Staff who already passed the course (any version) or already match an active assignment for it are skipped, unpublished courses are skipped, and a retried session create reuses the earlier assignment instead of adding another. The create response reports `courseAssignments` (`assigned`, `skipped`, `unavailable`, or an `error` without undoing the session). Cancelling a session leaves its course assignments in place; cancel them from the course's Assign popup.

A Course step links a published Learning centre course. It is always required and cannot be ticked by hand: it counts as complete when the staff member has a completed Learning centre progress record for that course (any version). Course status is read live from the Learning centre store; reads never enrol, assign or complete anything.

New sessions choose a training checklist; the session stores an immutable copy of its steps, so later checklist edits or archiving never change scheduled sessions. Assessments save typed answers per step (validated on the server against the frozen step types, options and number limits) plus notes. Saving signs a staff member off automatically once every required step is answered and every course step is passed; the course pass times are frozen with the completed record. Completed records stay permanent. Sessions created before training checklists keep their original practical-skills list and assessment screen.

Tests: `node --test in-store-training-checklists.test.js in-store-training.test.js`.

### Training-only step types

Training checklists also offer step types that only exist for in-store training. Each has a pass rule that the server applies (and the assessment screen mirrors live); a required step must pass, not just be answered, before automatic sign-off:

- **Competency rating** — Not yet competent / Developing / Competent / Highly competent; passes at Competent or above.
- **Supervised attempts** — the trainer counts observed attempts (0–50) against a saved target (1–20); passes at or above the target.
- **Knowledge question** — the title is the question and a saved expected answer guides the trainer; marked Correct or Not yet, passing when Correct. Staff DTOs never include the expected answer.
- **Timed task** — the trainer records minutes and seconds against a saved target (5 seconds–2 hours); passes at the target or faster.
- **Staff confirmation** — the staff member types their own name in the trainer's presence; passes when it matches their account name (case and spacing insensitive). This is a recorded confirmation, not an electronic signature.

### Step logic

Training checklist steps can use the shared checklist logic (`public/ops-step-logic.js`) through the builder's Add logic pill:

- **Show this step** only when an earlier answer matches: a checkbox is (not) ticked, a number is above/below a value, a custom selection is (not) an item, a competency rating is (not) a level, a knowledge question is (not) Correct, or a competency/attempts/question/timed step passes or fails its built-in rule. A missing, later or hidden source hides the step.
- **Pass/fail check** on Number entry (lowest/highest passing value) and custom Selection (passing items).
- No corrective actions, photos or score points; the server rejects `failAction` and `points` on training steps.

The server validates rules when templates are saved and sessions freeze them with the steps. Hidden steps aren't counted or required; a required step with a pass rule counts as done only once it passes, so sign-off waits for every visible required step to pass. Answers to steps that become hidden are kept. The assessment reader and phone preview hide steps live, show the rule under each step and a Passed / Not yet badge for pass checks, and update the required-step count as answers change.

### Checklist settings

Each training checklist has a **Checklist settings** panel in the builder, saved as `settings` on the template and copied into every new session (later edits never change existing sessions; saves that omit `settings` keep the saved values):

- **Default session length** (`minutes`, 5–480, default 30) prefills Duration when the checklist is chosen in New in-store training, unless the duration was already edited.
- **Require assessment notes to sign off** (`requireNotes`) keeps the sign-off open until the trainer writes assessment notes; answers still save.
- **Sign-off valid for** (`validMonths`: never, 3, 6, 12, 24 or 36 months). Completed records get `validUntil` (Melbourne date, clamped to shorter months) and `expired`; the assessment shows Valid until / Expired, and the session list shows Sign-off expired. Display only — records never change.
- **Collapse finished steps** (`collapseDone`) folds done steps to their title in assessments and the phone preview; tapping one opens it again.
- **Assign linked courses automatically** (`assignCourses`, unchanged behaviour) now sits in the same panel.

### Trainer-only steps

Any non-section step can be switched to **Hide from the trainee** (`trainerOnly: true`). Trainers, managers and reporters see it with a dashed border and a "Trainer only" chip. The trainee's own session never includes the step, its answer or its course state; a step whose show-when rule depends on a trainer-only step is either left out or shown without the rule, based on the trainee's own saved answers, so trainee and trainer see the same visible steps. Trainer-only steps still count toward sign-off.

### Supervised attempts

The −/count/+ stepper is unchanged and still saves the number of attempts. Underneath, each recorded attempt gets its own card ("Attempt 2 recorded · 2 more attempts to go until it passes"), the attempt that reaches the target turns green ("Passed — all 4 attempts done"), and a dashed card shows the next attempt still needed. Display only.

### Step appearance

Assessment and phone-preview steps use modern cards (styling only, end of `public/in-store-training.css`): rounded shadowed cards with a left status stripe (green once passed/ticked, amber when Not yet), section headings with a primary rule, a progress bar under the required-steps count, a large rounded tick box for checkbox steps, company-primary choice pills (the radios stay for keyboards and screen readers), a joined −/count/+ stepper and soft Passed / Not yet pills. Light/dark, reduced-motion and forced-colour fallbacks are included; behaviour and saved data are unchanged.

### Builder page and phone preview


The desktop phone preview never moves while the builder scrolls: it is pinned (sticky) at the position where it first appears, and the phone is scaled (0.40–0.72) so the whole frame fits between that point and the bottom of the window, leaving room for the page's bottom padding. It refits when the window or the top bar/status above it changes size.
The training checklist builder opens as a full page inside In-store training (not a dialog), with a sticky header holding ← In-store training, Cancel and Save checklist. On desktop a 340 px phone preview sits beside the editor, using the shared phone frame and `.ops-preview-*` styles from the Checklist builder. It renders the steps with the same `stepList` renderer the assessment screen uses, so staff-facing layout matches real sessions; its answers are throwaway and never saved, and its controls are out of the tab order. The preview hides below 1100 px. Unsaved builder changes are guarded on leave, and background reloads never replace an open builder.


## Staff folders

In the In-store training list, anyone with two or more sessions in the current filters is grouped into one folder card showing their name, number of trainings, how many are signed off and a progress bar. Opening the folder lists each training with its location, date, trainer, that person's step progress and status, and View session. People with a single session keep the normal session card; a group session still shows as its own card when any of its participants has only that session. Folders follow the existing search, status and location filters, stay open while filtering, and are display-only (no reads or writes beyond the existing list).

Home → Your work → In-store training uses the same idea: items carry a read-only `group` (the learner for single-learner sign-offs, or you for your own sessions) and `checklist` name, and two or more items for the same person collapse into an expandable folder with an average progress ring and an awaiting sign-off count. Rows inside show the checklist name. Grouping is display-only.
