App edit changes the wording of interface labels, headings, buttons and declared label templates. It leaves names, saved records, calculated text and numbers, typed input values, dropdown values and rich text unchanged. Individual and linked wording edits follow the same rule. Fonts, colours and other appearance settings remain customisable on data.

Static HTML labels receive wording sources from the server. For a dynamic interface label, use `appWording.label(element, originalLabel)` or set `data-app-template` and `data-app-values`. Keep generated values in the template's placeholders. Never pass a saved name or field value as an `interfaceLabel` key. Undeclared dynamic text is treated as data even when it happens to equal a label such as “Sales” or “Cart”.

Existing wording settings remain saved. Settings that target data no longer change its displayed wording; they do not change the underlying records.

## App edit interface

On desktop, App edit changes **icons only**. It shows an orange frame and a floating edit bar at the bottom with the “App edit mode” label, the hint “Click an icon to change it”, **Your changes** and the one **Done** button. Hovering an icon outlines it with a name tag (for example “Sales today · Icon”); cards, text, buttons, images and other parts are not selectable, and clicking them behaves normally. On the main bar only the destination icons can be changed.

Clicking an icon opens a small quick toolbar: **Just this one / All like this (N)**, the shared icon list (the icon tile or **Change icon…**) and **Use original**. Each choice saves straight away and can be undone with **Undo** (the last 20 changes). **Your changes** lists the saved customisations on the current page (and the app bar), including older colour, image and wording changes, each with **Reset**, plus **Reset everything on this page** after a confirmation.

Moving and resizing Home sections and changing the Home greeting happen in **Edit Home** on Home, not App edit. Previously saved colours, images, fonts, wording and arrangements keep applying. Phones keep App edit suspended.

## Renamed labels

Knowledge Library is now called **Knowledge centre** in the interface (matching Learning centre). Routes, API paths, permission IDs and data keys keep their `knowledge-library`/`knowledge.*` names. Saved company wording for the old labels (`Knowledge Library`, `Search library`, `‹ Back to library`, `Library view`, `Library categories`, `No library articles yet.` and the uncategorised-article hint) is read and saved under the new label through the legacy label aliases in `interface-text.js`, so custom names keep working.
