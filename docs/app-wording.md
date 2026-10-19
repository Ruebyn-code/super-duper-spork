App edit changes the wording of interface labels, headings, buttons and declared label templates. It leaves names, saved records, calculated text and numbers, typed input values, dropdown values and rich text unchanged. Individual and linked wording edits follow the same rule. Fonts, colours and other appearance settings remain customisable on data.

Static HTML labels receive wording sources from the server. For a dynamic interface label, use `appWording.label(element, originalLabel)` or set `data-app-template` and `data-app-values`. Keep generated values in the template's placeholders. Never pass a saved name or field value as an `interfaceLabel` key. Undeclared dynamic text is treated as data even when it happens to equal a label such as “Sales” or “Cart”.

Existing wording settings remain saved. Settings that target data no longer change its displayed wording; they do not change the underlying records.
