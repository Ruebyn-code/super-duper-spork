# Kiosk sign-in screen

A paired kiosk (`/kiosk`) shows a sign-in screen for the device's location.

## Layout

- The sign-in screen has no top bar. The welcome panel holds the location, today's trading status and the full-screen button. The top bar remains on the pairing screen.

- **Company logo and collapsed sign-in:** the sign-in panel starts collapsed. The company's saved logo (the Opstack logo when none is uploaded) sits large in the middle of the panel, with no background, above the location name. A **Tap to sign in** bar at the bottom slides the name list up over the logo; the bar's arrow (or Escape on the name list) collapses it again, and it collapses by itself after 45 seconds without input. Typing a letter or number also opens it. The collapsed bar also shows up to three **recent sign-ins** on this device as chips (initials, first name and how long ago, such as *5 min ago*); tapping a chip opens the PIN pad for that person straight away. While collapsed, the list is inert. A paired, locked kiosk may load only `/logo` and `/sidebar-logo` for its own company; every other page or setting still needs a staff PIN.
- **Welcome panel:** a gradient of the company's primary colour (lighter at the top, deeper at the bottom), with a greeting for the time of day, a large Melbourne clock, the date, the location and short tips. On tablets in portrait and on phones it shrinks to a compact band, and on phones it hides while the PIN pad is open.
- **What's happening:** inside the welcome panel, today's trading status (Open · closes 10pm, Closed now) and up to four company posts from the last 60 days (company-wide and network-wide posts for the kiosk's company), each with its title, a short excerpt, the author, *Must read* when required, and how long ago it was posted. On portrait tablets the posts scroll sideways; on phones they are hidden. Tap a post to read it in full without signing in: a popup shows the title, who posted it and when, and the formatted text. Close it with ×, **Done**, Escape or a tap outside; it closes by itself after 90 seconds without use. Images, files, videos and external embeds are left out with a note to sign in to see them, required posts say to sign in to mark them as read, and reading on the kiosk never marks a post as read.
- **Who's signing in?** Compact name tiles for everyone who can sign in at this location, with coloured initials avatars. Staff who signed in recently on this device appear first. **Search your name** filters the tiles; typing on a physical keyboard starts a search.
- **PIN pad:** tap your name, then enter your four-digit PIN on the round keypad. The dots fill as you type and it signs in automatically on the fourth digit; **Sign in** is still there. A wrong PIN shakes the dots and says so. **Not you?** goes back. Physical keyboards can type digits and use Backspace and Escape.
- **Not listed? Sign in with your PIN only** keeps the original PIN-only sign-in for anyone missing from the list. If the list can't load or is empty, the kiosk goes straight to PIN-only.
- After 45 seconds without input, an open sign-in panel returns to the name list and collapses back to the logo.

## Privacy and security

- `GET /api/kiosk/staff` works only for a paired device. It returns the `id` and `name` of activated accounts with a clock PIN that can access the device's location. It never returns phone numbers, PINs, photos, roles or other locations' staff, and it is `no-store`.
- When a name is chosen, the unlock request includes that `userId` and the server only accepts the PIN if it belongs to that person. Choosing a name never grants access by itself. PIN rate limits, location access checks and the two-minute idle lock are unchanged.
- `GET /api/kiosk/staff` also returns `trading` (the shared trading-status model for the device's location) and `news`: post `id`, `title`, an excerpt of at most 160 characters, `authorName`, `createdAt`, `scope` and `required`. Full post content, rich text, media, reactions and read receipts are never returned, and `news` is empty when Comms is switched off for the network. Company posts already reach every member of that company, so this shows nothing beyond what the location's staff can read.
- `GET /api/kiosk/posts/:id` works only for a paired device and only for company/network posts of the kiosk's company from the last 60 days (the same rule as the feed), and returns 404 when Comms is switched off. It returns the title, author, dates, plain text and formatted text with image, gallery, video, audio, document and embed blocks removed (`hiddenItems` counts them). It never returns media IDs, reactions or read receipts, never records a receipt, and is `no-store`.
- Recent sign-ins are kept per device in browser storage as account IDs with the time of the last successful sign-in, never PINs, names or session tokens. Older saves that hold only IDs still work.
- Pairing works as before, restyled to match.

## Signed-in kiosk bar and auto sign out

- **Top bar:** once a staff member signs in, the kiosk shows a normal-width search bar on the right, joined to the blue account button and notification bell (a full row on phones), plus a red **Sign out** button (an icon only on phones). Sign out locks the kiosk and returns to the sign-in screen, the same as Lock kiosk in the account menu.
- **Auto sign out:** each company chooses how long its kiosks wait without a tap or key press before signing staff out, in Settings → Kiosk devices → Auto sign out. Choices are 1, 2, 3, 5, 10, 15 or 30 minutes, or 1 hour; two minutes is the default when nothing is saved.
- The setting is stored per company in `kiosk-devices.json` (`settings.companies`) with a revision. Saving uses `PUT /api/kiosk-devices/settings` `{companyId, idleMinutes, revision}`, needs CSRF, `devices.manage` and `locations.all` in that company, and rejects unlisted values and stale revisions. Location-only kiosk managers can see the setting but not change it.
- The server enforces the time: each PIN sign-in and each real tap or key press sets the grant's expiry to now plus the company's time. A change applies from the next sign-in or tap. Background reads never extend it.

## Training-only kiosks

Each kiosk has a **Kiosk type** in Settings → Kiosk devices (Add kiosk or the device's Settings): **All app features** (the default, `features: ['app']`) or **Training only** (`features: ['training']`). Writers that omit `features` keep the saved type, and changing it bumps the device revision, so anyone signed in is signed out.

On a training-only kiosk, staff still sign in with their own PIN, but their session keeps only their own training grants (`learning.view`, `learning.complete` and `learning.signoff`, and only if they already have them) — so nothing can be built, scheduled or assigned there: no course authoring (`learning.manage`), training checklists, session scheduling or course assignment (`learning.assign`) and no reports; appointed trainers can still sign off sessions; every detailed action outside these is switched off. The restriction is applied in `kiosk-policy.js` and again in `permission-levels` `decorate` (through the session's `kioskTraining` flag), so per-company permission checks can't restore other access. Signing in and `/kiosk` open the Learning centre, any other signed-in app page redirects to it (Help stays available), Home links are hidden (`kiosk-training` on the shell) and `/api/session` reports `kiosk.feature: 'training'`. The idle sign-out, location pinning, PIN rules and required-reading gate work as on other kiosks.

### Training kiosk look

Training kiosks look different so staff can tell them apart (display only, no extra reads or writes):

- **Locked screen** (`kiosk-training-device` in `public/kiosk.js`/`kiosk.css`): a Training station greeting, a "Your training, in one place" panel in place of the What's happening feed, no promotions carousel, the company logo with a Training badge and a "Tap to start training" sign-in bar.
- **Learning centre** (`kiosk-training-frame`, `public/learning-kiosk.css`/`learning-kiosk.js`, added by the server only inside training kiosks): a welcome banner with the person's first name and location, and large touch tabs (My learning, Course library, In-store training) instead of the left subpage rail.
- **Header**: the search field is hidden, and the Sign out button shows a live m:ss countdown to the automatic sign out (it resets when staff tap or type, like the normal idle lock).
