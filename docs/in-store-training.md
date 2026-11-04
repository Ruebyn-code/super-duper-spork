# In-store training

Learning centre → In-store training schedules practical sessions separately from online course versions and quiz results. A session fixes its location, trainer, named staff, skills, Melbourne date/start time and 5–480 minute duration. Managers need `learning.assign`; candidates must currently belong to the company and location, have Learning centre access, and staff need `learning.complete`. An appointed trainer needs the optional `learning.signoff` action, which inherits `learning.view` and can be denied explicitly in Permission levels. The action does not permit scheduling or assessment of arbitrary sessions. Managers also need it to override the appointed trainer. Nobody can assess themselves.

Staff see only their own practical progress and notes. Appointed trainers see their session’s staff; training assignment managers and training report viewers can review sessions within current location access. Kiosks stay at their pinned location. Every write rechecks current staff roles and membership inside the storage queue; removed trainers and staff cannot continue assessments. APIs inherit normal sign-in, required Comms reading, company context and CSRF enforcement from Learning centre.

Only explicit Create session, Save assessment or Cancel session actions write records. Reads never enrol or complete work. Assessments cannot be saved before the scheduled start. Partial assessments record the checked skills and notes; the final explicit save records completion and assessor attribution. Completed records are immutable. Cancellation prevents further assessments and preserves earlier sign-offs. Dates use the existing Melbourne planner conversion, reject nonexistent DST clock times and use the later repeated time consistently with planners.

`in-store-training.json` is a private atomic file in the existing persistent data directory, using a shared per-file mutation queue. Session creation, assessments and cancellation have actor-bound idempotent request references. Assessment revisions are per staff member so different learners can be assessed independently, while conflicting edits to one learner fail. Private request snapshots retain the assessment history; API DTOs never return fingerprints or raw audit records. Older online courses, assignments, quiz answers and their reports remain unchanged. Practical summaries and filtering are on the In-store training page.

The shared left navigation reuses the new `#in-store` Learning centre view. Scheduling and assessment use bounded native dialogs with explicit saves, disabled pending controls, stable retry references after uncertain responses, unsaved-change guards and restored opener focus. The shared Help icon opens written, picture and video instructions. No operational email, message, AI call or automatic roster entry is created.

Run `node --test in-store-training.test.js detailed-permissions.test.js learning-centre.test.js`, then the full suite. Check desktop/phone session creation, partial progress, reopening, final sign-off, staff privacy, trainer action limits, conflicts, DST, company/location/kiosk scope, draft guards and lost-response retries. Capture only isolated demo data for guide media and build/start the production image before pushing.

## Training checklists and embedded courses

Training managers (`learning.assign`) build reusable **training checklists** under In-store training → Training checklists. The builder reuses the Ops checklist step editor (`public/ops-step-editor.js` with its `kinds`, `selectionSources` and `extraDetails` options) limited to Checkbox, Short/Long text, Number entry, custom-item Selection, Section, Instruction and **Course** steps. Saves are explicit, revision-checked and use actor-bound request references; archiving keeps scheduled sessions intact. Checklists live in the same private `in-store-training.json` (`templates`), scoped to the company.

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
