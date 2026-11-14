# Knowledge centre extras

Articles live in `knowledge-library.json`; personal engagement lives separately in `knowledge-engagement.json`
(favourites, views, feedback, questions, read confirmations and quick-check results) so it never changes an
article's revision. Everything goes through `knowledge-library-routes.js` with the normal session, CSRF,
required-reading and article visibility checks (company/network scope, permission-level audiences, category limits).

## Reading
- **Landing lists** — `GET /api/knowledge-library/home`: favourites, recently viewed (your own views), most read
  (distinct readers in the last 90 days), articles to confirm, and for publishers/owners an upkeep list (approval
  requests, reviews due, unanswered questions, drafts).
- **Favourites** — `PUT /:id/favourite {favourite}` (≤200 per person).
- **Views** — `POST /:id/viewed`, sent once when the Knowledge centre page opens an article (never from search
  results or the article popup).
- **Contents, Step by step, Print** — client only (`public/knowledge-extras.js`): contents from rendered headings;
  step mode splits by headings (or a numbered list); print CSS shows only the article. Nothing is saved.
- **QR code** — `GET /:id/qr.svg` (private, no-store) encodes the article link; scanning still needs access.

## Interaction
- **Was this helpful?** — `PUT /:id/feedback {helpful: true|false|null, comment?≤500}`; readers see only their
  own; publishers see totals and comments.
- **Questions** — `POST /:id/questions {text≤500, requestId}` (≤200 per article); the owner or a publisher answers
  with `PUT /:id/questions/:qid {text≤1000}` (blank clears); the asker or a publisher removes with `DELETE`.
- **Read and confirm** — article `confirm: true`; `POST /:id/confirm {contentVersion}`. Confirmations are tied to
  `contentVersion`, which only increases when the published wording changes, so new wording asks again.
  Publishers see who has and hasn't confirmed in their company.
- **Quick check** — article `check` (≤3 questions, 2–6 answers, correct index kept server-side and hidden from
  readers until they try). `POST /:id/check {contentVersion, answers}` grades on the server; retakes allowed.

## Upkeep
- **Owner** — `ownerId` (a person in the company who can use the Knowledge centre; defaults to the author).
  `GET /owners` lists choices for publishers.
- **Review dates** — `reviewMonths` 0/3/6/12/24; due = `reviewedAt` + months. Changing the published wording or
  `POST /:id/reviewed {revision}` (owner or publisher) resets it.
- **Drafts and approval** — save with `draft: true`. New articles stay `published: false` (publishers only);
  published articles keep their live wording and hold changes in `draft`. `POST /:id/approval {revision, cancel?}`
  requests (or cancels) approval; `POST /:id/publish {revision}` publishes (recording `approvedBy` when someone
  else requested approval); `DELETE /:id/draft` discards. Saving without `draft` publishes directly.
- **Versions** — each change to the published wording keeps the previous wording (≤30). `GET /:id/versions` and
  `POST /:id/versions/:contentVersion/restore {revision}` for publishers.
- **Related articles** — `relatedIds` (≤10 readable articles); readers only see ones they can open.
- **Post an update in Comms** — an explicit editor tick that posts through the native Comms posts API after
  publishing, with an article link block.

## Notifications
`libraryStore.notices` adds a read-only **Knowledge centre** category: articles to confirm, reviews due (owner,
or publishers when no owner), approval requests, new questions (owner/publishers) and answers to your questions.


## Landing cards

The landing lists (Needs your attention, To read and confirm, Your favourites, Recently viewed, Most read) show each article as a card: the article's first image (or a tinted book icon), title, a two-line excerpt, the category and a chip for readers or the upkeep note. Most read cards carry their #rank. Desktop shows a wrapping grid; phones show a swipeable row per list. Display only — the data comes from the existing `GET /api/knowledge-library/home` read.
