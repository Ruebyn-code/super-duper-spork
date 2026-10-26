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

Every guide offers **Read steps**, **Picture guide** and **Video guide**. Picture
steps have previous/next controls, keyboard navigation, an enlargement popup and
an original-size link. Videos are captioned illustrated walkthroughs using real
application screens and isolated synthetic demo data, with an accessible transcript
and an optional download. They have no voiceover and never autoplay. Media is
loaded only after choosing a visual format; changing format or guide stops the
active video. The ordinary written instructions remain the printable version.

The bundled library includes a separate video and matching picture sequence for
every guide. Each picture and caption uses the exact written step. If a guide's
title or steps change, its old media is hidden until regenerated. Snapshots are
examples, rather than the signed-in company's live records.

Media files are content-addressed under `public/help-media/`, with their sizes,
digests, captions and step associations in `public/help-media-manifest.js`.
`help-media.js` streams only those allowlisted files, including native MP4 byte
ranges for playback and seeking, HEAD and cache validators. Videos are not loaded
into the shared static-asset memory cache. Media contains generic demo material,
and uses the same public-asset policy as the generic guide text and scripts.

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

To regenerate visual guides, install the ordinary pinned app dependencies, plus
local developer tools Playwright, Chromium and FFmpeg/ffprobe. These tools are
used only to author documentation, not by the deployed app. Set
`OPSTACK_PLAYWRIGHT_MODULE` and `OPSTACK_CHROMIUM` when they are not at the capture
script's default developer paths. The fixtures always create a fresh temporary
data directory and use fake email responses; intelligence requests are rejected.

1. Run `node tools/capture-help-media.cjs --refresh` to capture all actual screens.
2. Review capture errors and the snapshots in `/tmp/opstack-help-media-build/scenes`.
   `OPSTACK_HELP_BUILD_DIR` can select a different temporary build location.
3. Maintain `tools/help-media-storyboards.cjs` so each written step points to the
   appropriate scene. Captures include visible, unobstructed control bounds so
   callouts do not highlight buttons hidden behind a dialog.
4. Run `node tools/build-help-media.cjs` to render pictures, H.264 MP4 clips and
   WebVTT captions. This updates the manifest and removes obsolete generated
   assets only after the new library is complete.
5. Review representative pictures and videos, validate every asset, and run the
   normal tests, desktop/phone playback checks and production image checks.
