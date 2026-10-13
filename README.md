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

Select **Edit** beside a stock item to expand its form directly underneath it and update its name, supplier, SKU, category, price, photo, or description, then select **Save changes**. **Cancel edit** leaves the item unchanged. Select **Remove stock** to delete an item from the catalogue. Remove all a supplier’s stock before removing the supplier. Previously saved requests retain their original item names, supplier names, and prices. Supplier and catalogue changes persist in `data/catalogue.json` across restarts. Keep the entire `data/` folder when replacing the application with a downloaded update.

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

## Automatic supplier order delivery

Administrators can edit each supplier’s delivery method and contact in **Suppliers & stock**, and enter sending credentials and enable/disable methods in **App settings → Supplier order delivery**. All methods default to off. Email uses Resend (requires a verified sender and API key); texts use Twilio (requires account SID, auth token, and a valid sending number). Supplier phone numbers must include country codes, such as +61400123456. Sending services may charge fees.

The ordering-system option posts supplier-specific JSON orders to a configured HTTPS endpoint using a bearer token. This is a generic API connection, not a universal connector for supplier websites; the supplier must provide a compatible API or an adapter must be built for its documented API. Only one shared system token is configured in this release.

Orders split by supplier and save before submission. Checkout reports **submitted**, **not configured**, **failed**, or **unconfirmed** for each supplier. Submitted means the service accepted the request, not that the supplier received or fulfilled it. Unconfirmed submissions are never retried automatically; check the sending service before resending. No previous orders are automatically sent when credentials are added. Repeating the same checkout request identifier does not send it again.

Credentials are held in ignored `data/delivery-settings.json` with private file permissions. They are not returned to the browser after saving; blank secret fields keep existing credentials. Disable a method to stop sending. Preserve and keep the data folder private. Provider credentials and real supplier contacts are required before actual sending can be validated.
