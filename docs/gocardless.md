# GoCardless reporting sync

OpStack owners use Console → Billing. Support, tenant Head Office accounts and
kiosks cannot access connection settings, location links or collection reports.
This is a read-only integration: every provider request is GET, to the fixed
Sandbox or Live GoCardless API, with API version 2015-07-06. Subscriptions,
mandates, invoices, collection attempts and refunds are managed in GoCardless.
No app action creates charges or changes authorisations.

## Setup

1. Start with Sandbox. Create a reporting API access token in the corresponding
   GoCardless dashboard and enter it in Billing.
2. Configure the webhook endpoint in that same dashboard, using the HTTPS
   address displayed in Billing and a matching signing secret. The server must
   have a valid HTTPS APP_ORIGIN. Endpoint paths are
   /api/opstack/gocardless/webhook/sandbox and /api/opstack/gocardless/webhook/live.
3. Save connection, then Test connection & sync. Review the completed run.
4. Link each imported AUD subscription to one existing OpStack network/location.
   Explicitly confirm applying location links to imported history.
5. Enable automatic sync and save. The server checks for work each minute,
   imports at least every 15 minutes while healthy, and queues extra refreshes
   from verified webhooks. Retry a failed import after correcting its cause.
6. Use Monthly report → Collections. Live is the default; Sandbox is explicitly
   selected and labelled. Configure and test Live separately when ready.

Only OpStack settings are saved; subscription billing terms and customer consent
remain in the provider/business workflow. The business is responsible for its
legal terms, GST treatment and invoices. No tax invoice or GST amount is inferred.

## Data and reliability

Credentials are stored only in private opstack/gocardless.json, mode 0600, never
returned by APIs or included in platform activity. Blank fields preserve saved
secrets; clearing credentials disables sync while retaining imported history.
Restrict filesystem/backups as for existing provider settings; this file does not
provide independent application-level encryption. No customer bank details,
mandate data, customer metadata or raw provider responses are retained.

Sandbox and Live have independent credentials, histories and location mappings.
Imports validate creditor identity to prevent mixing accounts. Every page must
succeed before the snapshot changes; failures preserve the prior snapshot and
display a stale/error notice. The import supports up to 100,000 records and 200
pages per resource; limits reject an import rather than silently truncating it.
Provider statuses are re-read, so late failures/chargebacks and out-of-order
notifications cannot replay old amounts over current data.

Notifications use HMAC-SHA256 over the exact bounded raw request body and a
constant-time comparison with Webhook-Signature. Recent event IDs are durably
deduplicated; acknowledgements follow durable queueing and do not make provider
requests. Full imports deduplicate provider resource IDs as well. Periodic reads
recover missed notifications and queued work after restarts. Updates or owner
revocation during a read withhold stale results. The approving owner must remain
an active platform owner for unattended imports.

Connection/link saves are revision checked, actor-bound and retry safe. Uncertain
responses freeze their original payload. Reads and report refreshes never initiate
provider requests, send emails, collect funds, change billing terms, write manual
fees/expenses or alter any tenant financial records.

## Monthly report basis

The existing Sales/Expenses overview remains the configured-fee report. Collections
is a separate view, so those fees and actual receipts are never added twice.

- Linked AUD payments use their charge date and latest provider status. Confirmed
  and paid_out contribute to Confirmed collections; submitted/pending amounts,
  failures/cancellations and chargebacks are separate. Unknown charge dates use
  the Melbourne creation date and remain visibly unassigned in payment details.
- Paid refunds use their Melbourne creation month, linked through their original
  payment. They are displayed separately and do not subtract amount_refunded a
  second time.
- Paid payouts and deducted fees use the payout arrival date. These are explicitly
  account-wide and are not allocated to locations or written into expenses.
  Provider-paid status is not independent reconciliation against the bank.
- Unlinked subscriptions and foreign-currency payments do not become location
  income. Reports show coverage start, last successful sync and errors. Unavailable
  history displays an em dash. Partial-month coverage is identified by its start
  date. Totals use integer cents; one location may have multiple subscriptions.

The API and webhook shapes were checked against GoCardless's official
gocardless-nodejs 11.4.0 package from npm (including types, fixed hosts, pagination
and signature verification). No new runtime dependency was added. Tests and media
use isolated synthetic data and fake providers only; a real merchant token and
reachable provider endpoints are still needed to verify a live connection.
