# Archived GoCardless records

GoCardless has been replaced by [Stripe Billing](stripe-billing.md). The app no longer connects, syncs or accepts GoCardless webhooks. Its old API routes return 410.

Existing private `DATA_DIR/opstack/gocardless.json` records are preserved without alteration. Owners can view saved snapshots in Monthly report → Collections → Archived GoCardless. This archive uses the original charge-date, refund-creation and payout-arrival rules and excludes unmapped and non-AUD records. It never exposes credentials or creates a provider connection.

Removing the connection **does not cancel subscriptions held at GoCardless**. Cancel or finish them in GoCardless before starting Stripe billing to avoid charging a customer twice.
