# Labels

Open **Labels** in the main navigation, or **More → Labels** on a phone. It is a separate page. Each company has its own label templates and label settings. Label history is limited to the selected location and the user's current access.

Head Office can manage company label templates/settings by default. All signed-in built-in staff roles can view and print labels. Settings → Permission levels has separate **Labels**, **Print prep labels** and **Manage prep labels** grants. Existing customised roles keep their permissions; grant the new controls explicitly where needed. Managing the shared company library/settings also requires access to all of that company's active locations.

## Create label templates

Choose **Add label template**, or **Template library → All templates** to include inactive templates. Use the category sidebar, search and sort controls to find labels. Choose a category when saving a template, or select **New category…** to add one. The same item name can be used in different categories. Templates without a category appear under **Uncategorised**. Open a card’s **… → Edit label template** to change it. Enter the name, approved shelf life in hours or days, and an optional label note. Save. Turn off Active label template in the editor to archive it. Shelf lives start blank: Opstack does not infer food safety storage periods. Use the company's approved procedures. Editing or deactivating an item does not rewrite existing label batches.

## Design each template

The **Label designer** has a live 50 × 25 mm artwork preview. Select a text field on the artwork or in Selected field, then drag it into position. Arrow keys move a focused field by 1% (Shift by 5%); Delete removes it. Position and size can also be entered as percentages. Add text fields for your own wording or choose automatic item name, location, prep/use-by time, staff name or note sources. Text before value changes prefixes such as “USE BY”.

Choose Arial, Verdana, Georgia or Courier New, point size, left/centre/right alignment, bold, italic or underline, visibility, date format and Fit text to box. Text wraps inside its box; turn Fit off to retain the chosen size and clip any overflow. The label remains black on white for the thermal printer. Save label template applies the design to future batches. Existing batches retain their original design, category, names and times. Reset label design restores the default field layout in the editor draft. Existing templates retain their original artwork until you change the design.

## Prepare and print

Click an active label card to open **Print labels**, then enter the preparation date/time and number of copies (1–100), then review the label. The use-by time is calculated from the saved item settings. Hour-based shelf life adds elapsed hours. Day-based shelf life keeps the same Melbourne time on the following date, including daylight-saving changes; skipped times use the first valid minute afterwards and repeated times use the later occurrence.

The default label shows item name, location, preparation time, use-by time, signed-in staff name and any note. Preparation time is an entered value; the record also keeps a separate server creation timestamp. Staff names, location and use-by calculation are resolved on the server. Concurrent item/settings changes require refreshing before a new batch can be created. Retries with the same request reference do not duplicate a batch.

**Print labels** creates a batch and opens the system print dialog. Select the installed **Zebra ZD411**, matching paper size, actual size/100% scale, no headers or footers and zero margins. Default media is **50 × 25 mm**, with **203 dpi**. If the printer is a 300 dpi model, select 300 dpi in **Label settings**. At 300 dpi, printable width is limited to 54 mm; at 203 dpi, it is 56 mm. Settings support 20–150 mm label height.

**Download Zebra file** produces a `.zpl` file using the same monochrome raster artwork as the preview, with label width/length in dots and the selected copy count. Send that raw ZPL file using your installed Zebra printer software or configured print workflow. Browser-generated files do not send themselves to the printer. Raster encoding keeps user-entered text out of executable printer commands and preserves glyphs available on the device.

Desktop printing requires an installed printer/driver or print service. Phone printing works only when that device can reach a supported system printer or printing service. The app does not install a USB/network bridge or assume that a ZD411 is available through AirPrint. The preview and ZPL generation can be tested without hardware; check an actual label on the configured printer to confirm media calibration and margins.

## History and storage

**Label history** shows the latest 25 created batches at the selected location. It records creation of the label data, not physical printer delivery. Print or download an earlier batch using its original name, shelf life, dimensions, preparation/use-by times and staff attribution.

The network's `prep-labels.json` contains company items, settings and immutable batch snapshots. Include it in backups and migrations. Company/location/permission checks and required-reading rules apply on every API request; label generation does not change stock counts, orders, sales or expenses.
