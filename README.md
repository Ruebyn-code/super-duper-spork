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

Requests are saved as individual JSON files in `data/` (ignored by Git). Totals are calculated by the server from catalogue prices. This is a local prototype: authentication, supplier integrations, live inventory, and an administration workflow must be added before public use. Request files contain contact details; keep the data directory private.

## Suppliers and stock

Open **Manage suppliers & stock** at the top of the page. Enter a supplier name and select **Save supplier**. Choose that supplier in the stock form, enter the item name, price in AUD, and quantity on hand, then select **Save stock**. SKU, category, and description help organise your items. Use the supplier buttons above the catalogue to view their stock.

Select **Edit** beside a stock item to update its name, supplier, SKU, category, price, quantity on hand, or description, then select **Save changes**. **Cancel edit** leaves the item unchanged. Select **Remove stock** to delete an item from the catalogue. Remove all a supplier’s stock before removing the supplier. Previously saved requests retain their original item names, supplier names, and prices. Supplier and catalogue changes persist in `data/catalogue.json` across restarts. Keep the entire `data/` folder when replacing the application with a downloaded update.

This app is for local use: anyone with access to the running app can manage stock. Stock quantities are informational; submitting a purchase request does not adjust them automatically.
