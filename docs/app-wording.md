App edit changes the wording of interface labels, headings, buttons and declared label templates. It leaves names, saved records, calculated text and numbers, typed input values, dropdown values and rich text unchanged. Individual and linked wording edits follow the same rule. Fonts, colours and other appearance settings remain customisable on data.

Static HTML labels receive wording sources from the server. For a dynamic interface label, use `appWording.label(element, originalLabel)` or set `data-app-template` and `data-app-values`. Keep generated values in the template's placeholders. Never pass a saved name or field value as an `interfaceLabel` key. Undeclared dynamic text is treated as data even when it happens to equal a label such as “Sales” or “Cart”.

Existing wording settings remain saved. Settings that target data no longer change its displayed wording; they do not change the underlying records.

## App edit interface

On desktop, App edit shows an orange frame and a floating edit bar with the “App edit mode” label, a short hint and a **Done** button that finishes editing. Hovering a supported part outlines it and shows a non-interactive name tag (for example “Button · Click to edit”).

The edit bar floats at the bottom of the screen (nothing on the page moves when editing starts) and holds the one **Done** button and **Your changes**, a list of the customised parts on the current page (and the app bar), each with **Reset**, plus **Reset everything on this page** after a confirmation. Hover tags name the section and the kind of part, for example “Sales today · Card”. Only parts that look like something can be selected (cards and sections with a fill, border or shadow, buttons, fields, icons and images); clicking text or an invisible wrapper selects the card around it. On the main bar only the destination icons can be changed.

Clicking a part first opens a small **quick toolbar** beside it: Just this one / All like this (N), six colour swatches and a custom colour (icon colour for icons), the shared icon picker for icons, Image…, Reset and More…. Every quick choice saves straight away through the same element-override writer and can be undone with **Undo** (the last 20 quick changes). Sections can also be dragged by their heading (dragging starts as soon as the pointer moves); the grip, press-and-hold and keyboard moves still work.

**More…** opens the full appearance editor as a panel docked to the side away from the selection, so the page stays visible. Draft colour, image and icon changes preview live on the selected part. The preview only changes inline styles temporarily: it restores the part's original inline style exactly before saving, on Cancel, Close or Escape, and when switching parts or link scope. Nothing is written until **Save changes**. Picking a colour for a fully transparent part resets transparency to 0% so the choice is visible. Phones keep App edit suspended.

## Renamed labels

Knowledge Library is now called **Knowledge centre** in the interface (matching Learning centre). Routes, API paths, permission IDs and data keys keep their `knowledge-library`/`knowledge.*` names. Saved company wording for the old labels (`Knowledge Library`, `Search library`, `‹ Back to library`, `Library view`, `Library categories`, `No library articles yet.` and the uncategorised-article hint) is read and saved under the new label through the legacy label aliases in `interface-text.js`, so custom names keep working.
