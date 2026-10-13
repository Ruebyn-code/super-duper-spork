# Stockroom

A stock ordering application with a searchable sample catalogue, category filters, editable quantities, and saved purchase requests. Prices are in AUD. Current stock is sample information; submitting a request does not change inventory or place an order with a supplier.

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
