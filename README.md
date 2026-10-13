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

Sign in as an administrator, then open **Administration** in the header. Enter a supplier name and select **Save supplier**. Choose that supplier in the stock form, enter the item name, price in AUD, and quantity on hand, then select **Save stock**. SKU, category, and description help organise your items. Use the supplier buttons above the catalogue to view their stock.

Select **Edit** beside a stock item to update its name, supplier, SKU, category, price, quantity on hand, or description, then select **Save changes**. **Cancel edit** leaves the item unchanged. Select **Remove stock** to delete an item from the catalogue. Remove all a supplier’s stock before removing the supplier. Previously saved requests retain their original item names, supplier names, and prices. Supplier and catalogue changes persist in `data/catalogue.json` across restarts. Keep the entire `data/` folder when replacing the application with a downloaded update.

Everyone must sign in. Ordering accounts can browse stock and submit requests; administrator accounts can also manage suppliers and stock on the separate Administration page. Stock quantities are informational; submitting a purchase request does not adjust them automatically.

## Set up sign-in accounts

Before using the updated app, stop the server with Control+C, then run these commands from the app folder:

```sh
npm run admin:set
npm run user:add
npm start
```

The first command creates or resets the administrator account. The second creates a regular ordering account; run it again for additional users. Choose your own usernames and passwords (12–256 characters). Password entry is hidden in Terminal. There are no default credentials or public account registration. Do not use the same username for an administrator and ordering user.

Open the app and sign in. Administrators see an **Administration** link for supplier and stock management. Regular users cannot access management pages or management APIs. Both account types can order. Sessions expire after eight hours; signing out, resetting the account, or restarting the server invalidates sessions. Passwords are stored as salted scrypt hashes in ignored `data/admin.json` and `data/users.json` files. Preserve the whole `data/` folder when upgrading. Keep it private.

For forgotten passwords, rerun `npm run admin:set` or `npm run user:add` with the existing username. Use the app locally on your Mac; an Internet deployment requires HTTPS and appropriate hosting configuration.
