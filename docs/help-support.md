# Help & support

Open **Help & support** in the blue account dropdown on desktop, phone or an
unlocked kiosk. The authenticated `/help` page uses the normal persistent
navigation shell, theme, company appearance and required-reading checks. Every
signed-in role can read the generic guides, without gaining access to any
operational feature or records.

Feature pages, section headings, builders and settings also have an **ⓘ** button.
It opens the relevant guide in a popup over the current work, with a guide picker,
written steps, pictures and videos. Closing restores focus to the icon and leaves
the underlying form and any existing popup intact. Guide browsing never saves,
publishes, sends, starts work or calls intelligence. Media is loaded only after
selecting its format, and closing the guide stops video playback.

Duplicated how-to paragraphs and old instruction-only expanders are hidden on
operational pages. Their nodes remain available to existing rendering scripts;
field labels, actual values, validation, empty states, autosave/sending results,
destructive-action warnings and provider/billing disclosures stay visible. User
authored checklist instructions, course lessons, articles and messages are not
altered. The standalone Help & support page retains the complete guidance.

`public/feature-help-model.js` owns page guide groups and bindings for app-owned
dynamic headings. Static headings use `data-feature-help` with stable guide IDs;
owned instructional nodes use `data-feature-instruction` or `feature-instruction`.
Never hide generic `.small`, `.ai-help` or user-content classes: they also contain
business values, results and errors. `public/feature-help.js` adds keyboard-accessible
icons and the read-only popup. Its shared assets join both shell and content
documents through `persistent-shell.js`; the platform console loads them directly.
Keep icons outside navigation links/buttons and outside user-authored content.

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

Videos run at 24 fps, with brief crossfades, a smoothly moving illustrative pointer
on matched controls, and a continuous progress strip. Screens and instructions
remain still during reading. Each step allows at least six seconds, with longer
instructions receiving more time. Captions and transcript timestamps share the
same frame-aligned timeline. Transcript steps can jump to a clear frame after
the transition and bring the player into view, without starting playback when
paused. Keyboard focus follows the jump to the player, and scrolling respects
reduced-motion preferences. The pointer demonstrates
where to look; it does not perform an action in the signed-in account. Use Picture
guide or Read steps for a completely static format.

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
   assets only after the new library is complete. For a single-guide preview,
   use `--guide place-order`; inspect the MP4 in the temporary `rendered` folder,
   then run the full build to publish its timeline and prune unused assets.
5. Review representative pictures and videos, validate every asset, and run the
   normal tests, desktop/phone playback checks and production image checks.

Pacing, crossfade length, caption boundaries and chapter positions are shared by
`tools/help-video-timeline.cjs`. Review representative decoded frames during a
transition, pointer movement, and the final hold. Check every video's native
metadata, playback and captions after generation; browser and test servers must
start after the final manifest/assets are written so they cannot cache obsolete
asset names during a rebuild.
