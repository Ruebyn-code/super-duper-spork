# Labels

Open **Labels** in the main navigation, or **More → Labels** on a phone. It is a separate page. Each company has its own label templates and label settings. Label history is limited to the selected location and the user's current access.

Head Office can manage company label templates/settings by default. All signed-in built-in staff roles can view and print labels. Settings → Permission levels has separate **Labels**, **Print prep labels** and **Manage prep labels** grants. Existing customised roles keep their permissions; grant the new controls explicitly where needed. Managing the shared company library/settings also requires access to all of that company's active locations.

## Create label templates

Choose **Add label template**, or **Template library → All templates** to include inactive templates. Use the category sidebar, search and sort controls to find labels. Choose a category when saving a template, or select **New category…** to add one. The same item name can be used in different categories. Templates without a category appear under **Uncategorised**. Open a card’s **… → Edit label template** to change it. Enter the name, approved shelf life in hours or days, and an optional label note. Save. Turn off Active label template in the editor to archive it. Shelf lives start blank: Opstack does not infer food safety storage periods. Use the company's approved procedures. Editing or deactivating an item does not rewrite existing label batches.

## Design each template

The **Label designer** uses a large dark stage with the actual 50 × 25 mm paper inside it. Press **Add a field**, then choose its type from the icon menu. Drag a field to position it; drag any edge or corner to resize it. Fields snap to paper edges, the centre and other visible fields, with alignment guides while dragging. Arrow keys allow precise positioning. The editor uses the selected company’s primary and secondary colours. The whole paper scales to fit the available screen; Save and Add a field stay visible while template details or field options scroll in their own panels. Expand Editing template fields for the instructions. Arrow keys move a focused field by 1% (Shift by 5%), Enter opens formatting and Delete removes it. An empty editor can be built up again, but a saved template needs at least one field.

Click a field to open **Edit field**. Change the source, text or default value, size slider, fit/wrapping, alignment, letter case, black/white inversion, bold, italic, underline and font. Date sources have date/time formats. More options contains the text prefix, precise point size and percentage positions, visibility and required dynamic values. **Done** keeps changes in the template draft; Close/Escape cancels that field’s changes. **Save label template** commits the whole design. The company-colour editing tint, alignment guides, borders and resize handles are not printed. Reset label design restores the default field layout in the unsaved draft.

Field types include Static Text, Name, User, Location, Current Date & Time, Preparation Date & Time, Ready Date & Time, Discard Date & Time, Shelf Life, Dynamic Text (On Label), Dynamic Text (On Print), and the template note. Static text stays the same for future batches. Name, User and Location use saved template/current server context. Current Date & Time captures the server’s batch-creation time; reprints keep it. Discard time uses the approved shelf life. Shelf Life displays its configured number and unit.

Ready Date & Time uses an explicit **Ready after** amount and period saved on the template. Minutes/hours use elapsed time; days keep the same Melbourne wall time across daylight saving. Zero is allowed if explicitly entered. Ready time must not fall after discard time; Opstack does not infer a ready delay.

Dynamic Text (On Label) is changed by clicking its highlighted area on the print preview. Dynamic Text (On Print) appears as an entry in the print form. Both may have a field name, default value and a required-entry option. Values apply to the current batch and do not change the shared template. Existing batches retain their original design, category, current/prep/ready/discard times and entered values for reprints.

## Prepare and print

Click an active label card to open its primary-tinted **Print labels** popup. The clicked card selects the template; the popup has no template selector or separate Use by row. Enter the preparation date/time and number of copies (1–100), then review the label. Use the secondary-colour − / + buttons to adjust the count, or type it directly. The compact popup keeps print actions visible while extra fields scroll, and scales the whole label into its preview without cropping or changing its printed size. The use-by time is calculated from the saved item settings. Hour-based shelf life adds elapsed hours. Day-based shelf life keeps the same Melbourne time on the following date, including daylight-saving changes; skipped times use the first valid minute afterwards and repeated times use the later occurrence.

The default label shows item name, location, preparation time, use-by time, signed-in staff name and any note. Preparation time is an entered value; the record also keeps a separate server creation timestamp. Staff names, location and use-by calculation are resolved on the server. Concurrent item/settings changes require refreshing before a new batch can be created. Retries with the same request reference do not duplicate a batch.

**Print labels** creates a batch and opens the system print dialog. Select the installed **Zebra ZD411**, matching paper size, actual size/100% scale, no headers or footers and zero margins. Default media is **50 × 25 mm**, with **203 dpi**. If the printer is a 300 dpi model, select 300 dpi in **Label settings**. At 300 dpi, printable width is limited to 54 mm; at 203 dpi, it is 56 mm. Settings support 20–150 mm label height.

**Download Zebra file** produces a `.zpl` file using the same monochrome raster artwork as the preview, with label width/length in dots and the selected copy count. Send that raw ZPL file using your installed Zebra printer software or configured print workflow. Browser-generated files do not send themselves to the printer. Raster encoding keeps user-entered text out of executable printer commands and preserves glyphs available on the device.

Desktop printing requires an installed printer/driver or print service. Phone printing works only when that device can reach a supported system printer or printing service. The app does not install a USB/network bridge or assume that a ZD411 is available through AirPrint. The preview and ZPL generation can be tested without hardware; check an actual label on the configured printer to confirm media calibration and margins.

## History and storage

**Label history** shows the latest 25 created batches at the selected location. It records creation of the label data, not physical printer delivery. Print or download an earlier batch using its original name, shelf life, dimensions, preparation/use-by times and staff attribution.

The network's `prep-labels.json` contains company items, settings and immutable batch snapshots. Include it in backups and migrations. Company/location/permission checks and required-reading rules apply on every API request; label generation does not change stock counts, orders, sales or expenses.
