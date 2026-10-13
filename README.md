# Souvlaki Gr ordering

A stock ordering application with a searchable catalogue, supplier filters, editable quantities, and saved purchase requests. Prices are in AUD. The app starts with sample stock; submitting a request does not change inventory or place an order with a supplier.

## Run

Requires Node.js 22 or newer. No external packages are required.

```sh
npm start
```

Open port 3000 in your development environment. Set `PORT` to choose another port.

```sh
npm test
```

Requests are saved as individual JSON files in `data/` (ignored by Git). Totals are calculated by the server from catalogue prices. This is a local prototype with administrator and ordering accounts. Supplier integrations and live inventory are not connected. Request files contain contact details; keep the data directory private.

## Suppliers and stock

Sign in as an administrator, then open **Administration** in the header. Enter a supplier name and select **Save supplier**. Choose that supplier in the stock form, enter the item name, price in AUD, then select **Save stock**. SKU, category, and description help organise your items. Use the supplier buttons above the catalogue to view their stock.

Below the stock editor, each supplier has its own collapsible menu with an item count, including suppliers with no stock yet. Expand a supplier to see its stock. Current and newly added items appear under their assigned supplier. Menus start collapsed and retain their open or closed state while you save changes. Select **Edit** beside a stock item to expand its form directly underneath it and update its name, supplier, SKU, category, price, photo, or description, then select **Save changes**. **Cancel edit** leaves the item unchanged. Select **Remove stock** to delete an item from the catalogue. Remove all a supplier’s stock before removing the supplier. Previously saved requests retain their original item names, supplier names, and prices. Supplier and catalogue changes persist in `data/catalogue.json` across restarts. Keep the entire `data/` folder when replacing the application with a downloaded update.

Everyone must sign in. Ordering accounts can browse stock and submit requests; administrator accounts can also manage suppliers and stock on the separate Administration page. Stock quantities are informational; submitting a purchase request does not adjust them automatically.

## Accounts and permissions

On a fresh installation, start the app with `npm start` and open it on the same computer at http://localhost:3000. The app shows first-time setup: choose an administrator username and a password of at least 12 characters. Once an account exists, first-time setup is locked. Existing administrator and user accounts from earlier versions are preserved automatically.

Sign in as an administrator and open **Administration → Accounts & permissions**. Create accounts as **Ordering user** (browse and order) or **Administrator** (also manage suppliers, stock, and accounts). Select **Edit permissions** to change a username or permission level, or enter a new password to reset it. Leave the password blank to keep it. You can remove accounts, but at least one administrator must remain. Changes to credentials or permissions invalidate that account’s active sessions immediately. Sessions also expire after eight hours or a server restart.

Account data is stored privately in ignored `data/accounts.json`, with salted scrypt password hashes. Keep the entire `data/` folder when updating. Legacy `admin.json` and `users.json` are read only until the unified account file has been saved; thereafter `accounts.json` is authoritative.

For forgotten administrator passwords, stop the server, run `npm run admin:set` in the app folder, then restart with `npm start`. This local recovery command resets the named account to administrator access. `npm run user:add` remains available for creating or resetting ordering accounts. Normal account management happens within the app.

Use locally on your Mac; an Internet deployment requires HTTPS and appropriate hosting configuration.

## Logo

As an administrator, open **Administration → App settings → App logo**, select your PNG or JPG (up to 2 MB), and save. The logo appears in page headers, including sign-in, and persists in `data/logo.json`. Refresh other open pages to see it.

Add or edit stock photos in **Administration → Suppliers & stock**. Choose a PNG or JPG up to 2 MB, then save the item. Photos persist in the catalogue and appear on ordering cards. Use **Remove photo** and save to clear a photo. On-hand quantities are no longer shown or entered.

## Spreadsheet catalogue

This release includes the 128 items and 11 suppliers from Book2.xlsx. The catalogue merges them once on first access after updating. Existing matching items and suppliers are preserved rather than overwritten. Imported edits and deletions are retained on subsequent starts. Keep your existing `data/` folder.

The spreadsheet provides 106 prices; 22 items have blank prices and display **Price pending**. Enter their prices by editing the stock items. Orders containing pending prices show the subtotal of known prices plus a pending-price notice. Pack sizes and item names follow the spreadsheet; prices are rounded to the nearest cent.

## Ordering and cart

The ordering catalogue shows 25 items per page. Use Previous/Next to browse; searching or choosing a supplier resets to page one and filters the complete catalogue. Select **Cart** in the header to review quantities and submit a request on its own page. Carts are saved per signed-in account in this browser’s local storage and cleared after a successful order.

Administrators can change primary/secondary colours and choose fonts for body text, app name, greeting, headings, stock names, buttons, labels, inputs, and navigation in **Administration → App settings**. Choices save in `data/appearance.json` and apply across pages, including sign-in. Refresh other open pages after saving.

## Account-specific email sending

Email is the only supported order delivery method. Only administrators can change account email settings. Open **Accounts & permissions**, then choose **Email settings** beside an account or in that page’s sidebar. Sender, credentials, and automatic email controls appear directly on the accounts page. Old email-settings links redirect here. Each account has its own verified sender, Resend API key, and enable switch. Credentials are private to that account in `data/account-email/<account-id>.json`. They are never shared, returned as text after saving, or inherited from shared environment settings. Administrators use the same personal email setup for their own orders.

Set supplier email addresses in **Suppliers & stock**. Each supplier receives only its own items. Existing email addresses are retained; former SMS/API configurations will not send and must be changed to email. Previous global credentials are left intact on disk but are no longer used. Ask an administrator to configure your account’s email settings. A verified Resend sender is still required.

Orders save before sending and report submitted, not configured, failed, or unconfirmed per supplier. Submitted means the email service accepted the request, not confirmed receipt. Unconfirmed submissions are not automatically retried. Repeated identical checkout request identifiers do not send again. Live email needs real credentials and supplier contacts.

Administrator pages use a left sidebar. Choose Suppliers & stock, Accounts & permissions, or App settings to display only that page’s controls. Supplier stock and delivery groups and font categories have independent collapsible sections. These sections start closed; supplier groups preserve their open state after saving, and validation reveals closed fields. Add stock, Add supplier, Accounts & permissions, Colours, Logo, and Interface text controls display directly when selected in the sidebar.

## Interface text

Administrators can rename built-in menus, headings, buttons, instructions, placeholders, and cart/pagination messages under **App settings → Interface text**. Search for the original wording, edit it, and save. Matching labels change everywhere; leave a field blank to restore its default. Preserve `{quantity}`, `{page}`, and other placeholders in formatted messages. Settings persist in `data/interface-text.json`. Supplier names, stock names, and account names continue to be managed through their own editing forms.

Administrators can also use **App edit** in the sidebar. Switch it on, click highlighted text where it appears, enter new wording, and save. **Finish editing** restores normal page interactions. This mode edits interface wording, not stock, supplier, or account data.

In App edit, select **Leave blank** and save to hide a label. **Restore original** brings its default wording back. Blank labels have a small `(blank)` marker only while editing, so you can click and restore them. The Interface text settings page also includes a Leave blank checkbox for each label.

App edit uses one panel for wording, fonts, background colours, and background images. Turn it on and click the part of the page to change; all applicable controls appear together. Font changes apply to the matching text group. Background changes apply to page, sidebar, panels, stock cards, stock image areas, buttons, fields, or greeting sections. You can upload/replace/remove PNG or JPG background images up to 2 MB, with a preview before saving. Changes are stored in `data/appearance.json`.

The same App edit panel includes **Text colour** and **Use original text colour**. Colour changes apply to the selected font group and save with the other appearance settings.

App edit has an **Apply changes to** selector. Choose **Only this item on this page** for isolated wording, blank text, fonts, text colours, backgrounds, and background images. Per-element overrides persist in `data/element-overrides.json` and take priority over shared settings. Stock cards use item-based identities so edits remain attached to that item when searching or paging. App settings → Colours lists the controls affected by the primary and secondary colours.

The App edit popup groups wording, text style, and backgrounds; Save and Cancel stay visible while the controls scroll. Colour fields accept hex codes or the picker. Background images expand only when needed. Draft changes are kept when switching between shared and single-item scope.

Saved appearance styles are included in each page before it renders. The bundled font is preloaded and cached using a content version; CSS and scripts revalidate against their content so downloaded updates take effect. Shared wording and per-item edits load with the page, and dynamic formatting processes changed sections instead of scanning the entire page after every update. Sidebar selections switch immediately without a page fade.

## Stock counts

Every signed-in account can open **Stock count** in the left sidebar. Choose **New count**, set the count date and optional location/notes, and expand a supplier to enter quantities. Search by stock name or SKU, or choose a supplier. Leave uncounted items blank; zero records an out-of-stock item. Use the item's usual units/packs, with up to three decimal places. Progress shows counted items across the entire catalogue even when a filter is active.

Drafts save automatically in this browser for the signed-in account and return after navigation or a refresh. **Clear draft** clears unsaved entries. **Save stock count** stores the entered items and opens **Count history**. Ordering users can review their own saved counts; administrators can review every account's counts. Records preserve the counted item and supplier names when catalogue entries change or are removed. Counts do not change the ordering cart, catalogue quantities, or send supplier emails.

Saved counts persist in `data/stock-counts/` across restarts and updates. Keep your entire **data** folder when updating. Unsaved browser drafts stay on the browser where they were entered.

The app name/logo appears at the top of the left sidebar, with the cart directly underneath. Use **Collapse sidebar** below the cart to switch to a compact icon rail, or the arrow to expand it again. The uploaded logo stays visible at a smaller size, along with the cart icon and quantity, ordering, stock count, sign-out, and an administrator shortcut. The browser remembers your sidebar preference across pages and refreshes.
