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

The landing lists (Needs your attention, To read and confirm, Your favourites, Recently viewed) show each article as a card: the article's first image (or a tinted book icon), title, a two-line excerpt, the category and a chip for readers or the upkeep note. Desktop shows a wrapping grid; phones show a swipeable row per list. Display only — the data comes from the existing `GET /api/knowledge-library/home` read.


The landing no longer shows a Most read list (the `popular` field stays in `GET /home` for compatibility).

## Categories are required

Every article must have a category: creating or editing an article without `categoryId` (or with `categoryId:null`) returns 400, and the editor's Category field is required with no Uncategorised choice. Network articles still need a network category. Older articles saved without a category stay readable; the list response's `uncategorised` count makes a **Needs a category** filter appear in the side bar while any exist, and they must be given a category the next time they are edited. A category that still has articles cannot be deleted (409 naming how many) — move its articles first.


## Layout

The category side bar is frameless like the app's other side bars (small uppercase Categories label, flat rows, Manage categories as a plain row), keeping its own collapse button. **+ Create article** floats as a pill in the bottom-right corner (same button, permissions and handler).

On desktop (above 1100 px) the All articles/Policies/Information tabs, audience and search sit in the heading row beside the Knowledge centre title; narrower screens keep them below the heading. The category side bar is 184 px wide (168 px on tablets).

The article reading view lines everything up in one dense 900 px column (contents as one row of links, the upkeep line and tool pills sharing a row, tighter spacing; on phones the page heading and category rail hide while reading): tags, title, meta, a quiet upkeep line (owner, review dates, Mark reviewed, Version history), one row of small tool pills (Favourite, Step by step, Print, QR code), contents, the article and the extras. Back is a plain link beside a compact Edit button, the floating Create article button hides while reading, and a first heading that only repeats the article's title is hidden (display only — the saved article is unchanged).
