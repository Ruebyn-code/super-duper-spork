# Liquid Glass appearance

Settings → App appearance → Colours includes an Interface style choice:
Standard (the default) or Liquid Glass. The local sample previews the selected
style and company colours. Only Save app settings commits it. Reset selects the
company's Standard defaults for the same explicit save.

`surfaceStyle` is an allowlisted company appearance field, saved through the
existing appearance permission, CSRF checks and atomic file queue. Partial edits
and older full writers preserve an omitted style. Unsupported values fail
without changing saved appearance. Existing companies remain Standard until an
appearance manager chooses Liquid Glass. Platform sign-in retains its separate
appearance scope.

The server selects the style before stylesheets paint. `applyAppearance` updates
the same root attribute in the persistent shell and active content frame after a
save. Pages opened later receive the saved company choice. Other open app tabs
use the existing appearance refresh behaviour.

Liquid Glass adds company-tinted translucent surfaces, static reflective
highlights and subtle inset edges across navigation, panels/cards, fields,
buttons, menus and dialogs. Blur belongs to navigation and transient surfaces;
cards use lightweight tints. Keep native geometry, fonts, action colours,
validation, focus outlines, shift-position colours, drafts and all data controls.
Explicit company/App edit backgrounds and uploaded images retain precedence.
OpStack intelligence retains its gradient, font, tint and shimmer.

The screen-only stylesheet leaves printable labels, exported documents and
authored rich content with their existing appearance. Reduced transparency,
forced colours and browsers without backdrop filtering get opaque surfaces.
No new motion, provider calls or operational writes accompany browsing or
previewing the style.

Validate persistence, older writers, company isolation, permissions/CSRF, initial
rendering and return to Standard. Browser checks cover the shell and native
pages, dialogs, fields, light/dark desktop/phone layouts, intelligence styling,
reduced transparency and printing. Use synthetic fixtures and fake providers.
