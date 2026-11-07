# Rich content formatting

Comms posts and messages, Knowledge centre articles and Training lessons use the
same structured rich-content renderer. Screen styles in `public/formatted-text.css`
provide consistent heading levels, paragraph/list spacing, quotes, tables, callouts,
accordions and media captions. Saved company fonts and explicit course section
fonts, colours and text sizes retain priority. General app typography and printed
layouts keep their existing owners.

Numbered lists use rounded badges with the company primary colour and a 16%
primary-colour fill over the current surface (twice the standard 8% tint).
Other list markers use the same primary colour; list text retains its authored
colour. Bullet points are solid rounded squares matching the number badge's
corner shape, at 0.385em (10% above the 0.35em disc size). They keep the existing
text indent and align with the first line of wrapped text.
Badges use native list counters and CSS decoration, so they do not enter
saved content or disrupt list editing. Printed lists keep native numbering.
Badges measure 1.44 times the body text size, with their numbers at 60% of that
text size and a compact gap; the list's written content keeps its authored size.

Posts, articles and lessons have a **Text style** button beside **Insert**. Choose
Normal text or Heading 1, 2 or 3 after placing the caret or selecting text. The
existing Insert → Heading path remains available, alongside lists, tables, quotes,
callouts and media. Chats keep their compact toolbar. Both menus preserve the
editor's selection, support keyboard navigation and restore focus on Escape.
Opening a menu does not modify or save content. Applying a style uses the native
editor history, ordinary saves and course draft autosave; publishing remains an
explicit, separate action.

Selecting text inside a writing field opens a small toolbar beside the selection.
It applies bold, italic, underline, bullet/number lists and links through the
existing editor commands. Posts, articles and lessons also offer the shared text
style menu there. The top toolbar remains available for media and other blocks.
Alt+F10 opens the selection toolbar from the keyboard, including at a caret;
Escape returns to the field. It follows visible text when scrolling and closes
when selection leaves the editor, the editor is disabled or the popup closes.
Keep the selection toolbar read-only until a formatting control is chosen, out
of saved content, and absent from readers/printed content. Destroy its popover,
animation frame and document/viewport listeners with the editor.

Post and article editors keep Audience and Title on one row, including phones,
with more room for the title. Article type and category sit together below it.
The native labels, audience permissions, category filtering and save actions
remain attached to the original fields.

`public/editor-menu.js` shares one popover between Insert and Text style, anchored
to the active button. Disabling the editor or destroying it closes the menu.
Keep upload guards, undo/redo, draft state and existing audience/permission checks.

Callout symbols are decorative SVGs rendered from a fixed allowlist. The stored
variant and text remain unchanged, and decorative icons/editor controls are not
included in serialization. Do not add computed appearance properties to the rich
text schema or reinterpret saved plain text. Keep private media references,
captions, tables, accordions, links, authored line breaks and inline marks intact.

Verify editor-to-reader round trips and explicit save/send actions with isolated
demo content. Check desktop/phone layouts, narrow course properties panes, live
preview, learner reading, required announcements, keyboard menus and custom course
styles. Browsing, previews and cosmetic changes must not create progress records
or call intelligence/providers.

## Knowledge centre article links

- **Rich text** (Comms messages and posts, Knowledge centre articles, training lessons): Insert → **Knowledge centre article** opens a search picker over the articles you can read. It inserts an `article` block, `{type:'article', articleId, title}`. The title is a ≤200-character snapshot, and the plain-text fallback is "Knowledge centre: <title>". It shows as a card in the editor and to readers. It's validated by the shared `formatted-text.js` normaliser, preserved by OpStack intelligence writing like media, and stripped from locked-kiosk post reads.
- **Checklists**: a step's options have **Knowledge centre article** (Link an article / Change / Remove) for any step except sections. It's saved as `article: {id, title}`, validated on the server and copied into run snapshots. In the checklist, the step shows a "Read the guide" button.
- **Popup**: both open `public/knowledge-article-popup.js`, a read-only dialog loaded on every signed-in page. It fetches through the normal permission-checked `GET /api/knowledge-library/:id`, so people only see articles they could open in the Knowledge centre. Otherwise it says the article isn't available. It has an **Open in Knowledge centre** link, closes with Close, Escape or the backdrop, and returns focus to the link. Opening it never edits, acknowledges or saves anything.
