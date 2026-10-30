# Opstack console

Opstack accounts are separate from network users. An **Opstack owner** creates networks, invites other owners and support staff, manages shared account setup emails, edits platform branding and reviews activity. **Opstack support** can open every active network without requesting approval. Support cannot create networks, manage Opstack accounts or change platform settings.

## First owner on Railway

1. Deploy the update and wait for Railway to show the deployment as Active.
2. Open the Railway SSH session for the app service, as used during the original setup. These commands must run **on Railway**, with the app volume mounted and the existing `DATA_DIR` environment variable.
3. Run `cd /app`, then `npm run opstack:owner`.
4. Enter your name, email and a new password of at least 12 characters. Confirm the password. Password entry is hidden.
5. Open `https://opstack.up.railway.app/opstack` and sign in using those new Opstack credentials. The blue account menu and app sign-in page also link to **Opstack console**.

The command creates only the first Opstack owner. It does not promote a network Head Office account or reset any existing user. Once an owner exists, further Opstack accounts must be invited from the console. At least one active owner must remain; pending invitations do not count. A network user, even Head Office with all custom permissions, cannot grant themselves Opstack access.

## Shared settings

**Account setup emails** contains the sender address, Resend API key, enable switch and welcome template. Use a sender on a domain verified in Resend. Saved API keys are never returned to the browser; leaving the box blank preserves the key. The screen confirms when a key is saved. Existing shared sender settings are retained in the same file when the console is enabled.

Subject, heading, welcome message and password button text can be edited. `{{name}}`, `{{inviter}}` and `{{company}}` fill in automatically. Opstack always includes a single-use password link, the sign-in email and 48-hour expiry information. Account setup is separate from supplier order email templates and location sender credentials.

**New network defaults** sets the starting primary/secondary colours, built-in font, personalised home greeting and sign-in welcome. The initial defaults are primary **#008CFF**, secondary **#45EFC3**, Arial, **Hello {user}**, and **Welcome to Opstack**. Keep `{user}` exactly once in the greeting; the app fills in the signed-in person's name. New networks take a snapshot of these values, and companies subsequently created within those networks start from that same snapshot. New companies in older networks without a snapshot also receive these defaults, independently of the existing company's custom formatting. Saving new defaults affects future networks, preserving existing networks and company customisations. The company appearance reset button uses its saved starting theme. The default greeting is Hello followed by the person's name; the old Yassou label is no longer shown in Home or the appearance editor. Existing custom greeting wording remains supported.

**Platform appearance** opens the existing editor for shared sign-in branding, backgrounds and default logos. Only Opstack owners can edit these settings after the first owner is created. New networks with a defaults snapshot use their own starting colours, normal font and welcome text on sign-in while retaining the shared Opstack logo and background images. Networks without a snapshot keep the existing shared sign-in appearance. Each company retains its own in-app appearance. Shared platform appearance and account emails are no longer editable by network Head Office accounts.

On the first network request after this update, a one-time migration checks all existing companies. It applies the new defaults only when all existing styling still matches the old or current defaults. Any custom colours, fonts, text, blank labels, backgrounds, images, logos, uploaded fonts, App edit overrides or rearranged layouts preserve the entire network's existing formatting. Business records and accounts are never changed. The result is recorded in `defaults-migration-v2.json`, so later edits are not overwritten on restart.

## Networks

In **Networks**, choose **Create network**, enter a unique network code, the initial company and location, and the first Head Office user's name and email. A working shared email sender must be configured first. New networks start with an empty catalogue and no old users or history. The initial Head Office user receives a network-specific setup link and chooses their own password.

Each network card shows its sign-in URL. All URLs use the same Opstack sign-in branding. Users can open the main app URL and sign in with their email and password; Opstack verifies the credentials and selects their network automatically. An old network or support selection does not override normal sign-in. Network-specific sign-in links remain scoped to their network. The optional Network code field is available for legacy accounts whose same credentials exist in multiple networks; no network directory is exposed. Each tenant email can belong to only one network. Network creation, invitations and email/username edits reject addresses owned by another network, including pending users and suspended networks. The check and write are serialized to prevent concurrent duplicate claims. Existing duplicates are retained for an authorised administrator to resolve; users can sign in with their network code in the meantime. Opstack owner/support accounts remain separate from tenant membership. A password session still expires after eight hours. Failed invitation delivery leaves the network and pending user available; correct the sender and choose **Resend setup email**.

**Open network** enters using the Opstack account's own support identity, without signing in as a customer or creating an employee account. The orange support indicator identifies the network and links back to the console. Support can manage network records, companies, users and permissions using that identity. Active Opstack operators appear in Comms with an Opstack label and can chat using their own identity. Personal features such as another employee's clock PIN and private chat membership are not impersonated; support sees private conversations only when it is a participant. Company/location switching continues to work. Opstack owners can rename or suspend networks; a suspended network cannot be opened until reactivated.

## Monthly report

Owners can configure GoCardless under **Billing**, using separate Sandbox and Live
API tokens and webhook signing secrets. Save connection, run **Test connection &
sync**, link imported AUD subscriptions to locations and enable automatic sync.
The HTTPS webhook address is displayed once APP_ORIGIN is configured. Scheduled
checks and verified notifications import payment results; the integration only
reads GoCardless and never creates charges or changes subscriptions. See
[GoCardless setup and report basis](gocardless.md).

Open **Opstack console → Monthly report** as an Opstack owner. Support and network users cannot access this financial report. Choose the month with Previous/Next, This month or the expanding calendar control; its month/year menus use the in-app selectors.

**Sales** lists locations grouped by network, with each network's subtotal. New networks and locations appear automatically from their Melbourne creation month. Use a location's edit icon to set its recurring monthly fee and optional notes. The amount carries forward until another fee is set, and changes begin in the selected month. Earlier months and any later scheduled changes remain intact. Fees apply to a full month; blank means no fee configured and 0 means free. Archived locations and suspended networks retain their saved fees until you change or clear them.

**Expenses** contains Opstack's named monthly cost entries, amounts and optional notes. Add/remove entries and choose **Save expenses**. Expenses apply only to the selected month. Switching tabs retains drafts; save or reload changes before switching months. Concurrent edits require reloading rather than overwriting another owner's changes.

The report uses the compact weekly-report layout: tinted table headers, network subtotals, a total row and overview cards directly underneath. Sales and Expenses share the month controls at the top. The overview shows Sales, Profit and Expenses. Sales adds configured location fees once; Expenses adds that month's saved costs. Profit is Sales minus Expenses, coloured green for positive, red for negative and yellow for zero. Unconfigured location fees leave Profit unavailable and show how many fees need entering. These amounts are platform reporting records and do not alter tenant sales, ordering budgets or expenses. Report edits do not send invoices or collect payments.

**Collections** separately shows confirmed GoCardless payments, pending amounts,
failures, refunds and chargebacks by linked location. Paid payouts and deducted
fees are explicitly account-wide. Live is the default; Sandbox must be selected
and remains labelled. Check the coverage date, last sync and any errors before
using retained results. These figures are not added to configured fee income or
written into manual expenses. Missing history displays an em dash. Existing
unsaved expense drafts survive collection refreshes and environment changes.

## Storage and activity

- Existing network files remain at the original `DATA_DIR` location. No old data is moved or deleted.
- Additional networks live under `DATA_DIR/networks/<network-id>/`, each with separate accounts, companies, locations, catalogue, records and company customisations.
- Opstack accounts, network registry and the latest 5,000 activity events live in `DATA_DIR/opstack/platform.json`.
- Dated location fees live in `DATA_DIR/opstack/monthly-location-fees.json`; monthly Opstack expenses live in `DATA_DIR/opstack/monthly-expenses/YYYY-MM.json`. Both are included when backing up the whole data directory.
- Future-network defaults live in `DATA_DIR/opstack/new-network-defaults.json`; each new network's initial snapshot is in its own `network-defaults.json`. New companies also retain `company-defaults.json` in their customisation folder.
- The shared account sender remains in `DATA_DIR/account-email-settings.json`; platform appearance remains in `DATA_DIR/platform-appearance/`.
- Back up the **entire** persistent data directory, including those folders. Keep a single application replica with the existing file storage design.

Platform login, account changes, network opens and support API mutations are logged under **Activity**. Logs include the Opstack identity, network, action, timestamp and response status, excluding passwords, keys, request bodies and setup tokens. Disabling or changing an Opstack account invalidates its active sessions immediately. Platform and network sign-in sessions are memory-only and require signing in again after an app restart.

Automated tests use temporary directories and simulated email responses. They do not send real invitations or modify Railway production data.
