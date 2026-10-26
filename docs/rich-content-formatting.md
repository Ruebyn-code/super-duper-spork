# Rich content formatting

Comms posts and messages, Knowledge Library articles and Training lessons use the
same structured rich-content renderer. Screen styles in `public/formatted-text.css`
provide consistent heading levels, paragraph/list spacing, quotes, tables, callouts,
accordions and media captions. Saved company fonts and explicit course section
fonts, colours and text sizes retain priority. General app typography and printed
layouts keep their existing owners.

Numbered lists use rounded badges with the company primary colour and a 16%
primary-colour fill over the current surface (twice the standard 8% tint).
Other list markers use the same primary colour; list text retains its authored
colour. Badges use native list counters and CSS decoration, so they do not enter
saved content or disrupt list editing. Printed lists keep native numbering.

Posts, articles and lessons have a **Text style** button beside **Insert**. Choose
Normal text or Heading 1, 2 or 3 after placing the caret or selecting text. The
existing Insert → Heading path remains available, alongside lists, tables, quotes,
callouts and media. Chats keep their compact toolbar. Both menus preserve the
editor's selection, support keyboard navigation and restore focus on Escape.
Opening a menu does not modify or save content. Applying a style uses the native
editor history, ordinary saves and course draft autosave; publishing remains an
explicit, separate action.

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
