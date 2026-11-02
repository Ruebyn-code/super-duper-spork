# Phase 6 — Comms, library and learning

Built in `rebuild/`, still running beside the current app on host port 3001.

**Gate:** required reading blocks the rest of the app until the same account
acknowledges it, and a failed quiz keeps its answers and grade on the server.

**Status: built and passing.** Four tests in `rebuild/test/comms.test.js` and
five in `rebuild/test/learning.test.js`; the Phase 1–5 tests still pass.

## What was added

| Module | Responsibility |
| --- | --- |
| `rebuild/comms.js` | Posts including required reading, the reading gate, direct messages and chats |
| `rebuild/library.js` | Company categories and articles, drafts, publication |
| `rebuild/learning.js` | Courses, immutable published versions, assignments, server-graded attempts |
| `rebuild/checklists.js` | Company templates, steps, runs with server-stamped step times |
| `rebuild/routes-comms.js`, `rebuild/routes-learning.js` | `/comms`, `/comms/thread`, `/library`, `/library/view`, `/learning`, `/learning/attempt` and their actions |

## How the rules were kept

- **Required reading is a gate on the app, not a badge.** `assertReadingClear()`
  runs before any private page except Comms and the migration console; an
  unacknowledged required post sends the reader to `/comms?reading=1`. Only the
  same account's explicit acknowledgement clears it, and reading the list never
  acknowledges anything.
- **Posts carry an audience.** A location post is visible to that location
  only, and creating one needs the posting grant.
- **Answer keys stay on the server.** A learner never receives the key; an
  attempt is graded server-side against the version its assignment was bound to.
  A failed attempt keeps its answers and score as evidence.
- **Published versions are frozen.** Editing a course afterwards does not
  change an existing assignment's questions.
- **Checklist runs are evidence.** A run starts explicitly, each tick is
  server-stamped, and a run cannot complete with steps unticked.

## Gate evidence

`docker compose -f docker-compose.base44.yml run --rm --no-deps rebuild node --test rebuild/test/comms.test.js rebuild/test/learning.test.js`

| Test | Covers |
| --- | --- |
| a required post stays outstanding until the same account acknowledges it | another account's `409`, same account clears it |
| a normal post never raises the reading gate | non-required post inert |
| a location post is visible only to that location, and posting needs the grant | audience and permission |
| a chat reaches only its members and unread counts clear on an explicit read | membership, explicit `markRead` |
| a published course keeps its answer key on the server | learner DTO carries no key |
| a failed quiz keeps its answers and score on the server | failed attempt persisted |
| an assignment stays bound to the version it was made against | frozen questions |
| checklist runs record server-timed steps and complete only when every step is ticked | server stamps, completion guard |
| course and checklist managers are separated from learners | author vs learner permissions |

HTTP checks behind a Head Office session: `/comms`, `/library` and `/learning`
each return `200` with rendered content and no error text.

Signed-in visual checks in the platform preview are **not automatically
verified** (second project, no session carried between calls); sign in with a
demo account to see them.

## Deliberate limits — not built in this phase

- The rich-text editor, media uploads and private attachments of the current
  app are not ported: posts, articles and lessons are plain text here.
- Direct messages are text only; there are no groups beyond a two-member chat,
  no unread badges in navigation and no notifications.
- Courses use single-choice questions; the other eight question types, timers,
  minimum reading time and practical in-store sign-off are not ported.
