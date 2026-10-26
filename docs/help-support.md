# Help & support

Open **Help & support** in the blue account dropdown on desktop, phone or an
unlocked kiosk. The authenticated `/help` page uses the normal persistent
navigation shell, theme, company appearance and required-reading checks. Every
signed-in role can read the generic guides, without gaining access to any
operational feature or records.

Browse feature categories, select a popular how-to, or search guide titles,
summaries, keywords, steps and notes. The feature filter narrows results. Search
is local and makes no intelligence/provider request. Guides contain numbered
steps, important details, related guides and an **Open this feature** link when
the account has the required page permissions. Current granular permissions and
audiences still control actions on the destination page.

Guide, category and search URLs can be bookmarked or shared. **Copy guide link**
removes the internal content-frame query flag. The reader keeps a Back to guides
link to the last browse/search view. Ordinary browser Back/Forward continues
through the persistent shell.

**Copy support details** prepares a plain-text issue template with current
company/location, time and the open guide. The user adds the affected screen,
steps, expected/actual result, visible error and relevant order reference/date.
Text remains visible for manual copying if clipboard access is unavailable.
Users contact their manager in Comms or their organisation's existing support
channel; copying does not create a ticket, message or email. Credentials and
private operational records are not collected.

Author the generic guide content in `public/help-guides.js`. Keep its stable IDs,
category IDs, related links and permission-aware destinations valid. Update the
relevant guides whenever a feature's workflow or calculation changes. Avoid
internal data paths, real provider keys or organisation-specific records in
generic content. Page presentation and routing live in `public/help.js` and
`public/help.css`; registration is shared with normal authenticated pages.
