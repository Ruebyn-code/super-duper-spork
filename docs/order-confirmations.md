# Order confirmation to the location sender

Every new live order sends one separate confirmation email to that location’s saved **Verified sender email**. Use **Locations → Edit location → Sending** to save the Resend key and verified sender address and enable **Automatically email this location’s orders**. No mailbox connection or additional API key is required. Sender addresses should be able to receive mail if you want the confirmation in their inbox.

The message confirms that the order was saved in OpStack. It includes the company and location, reference, ordering user, Melbourne save time, all suppliers’ items, estimated prices and totals, notes and supplier sending status. Unknown prices stay pending. A supplier service accepting a request does not confirm supplier receipt. Platform orders clearly say that they still need finishing in the supplier platform.

Supplier emails remain separate and contain only that supplier’s items, without prices. The confirmation uses a fixed full-order summary rather than the editable supplier template. It is not a BCC copy and is sent once per order, even if there are several suppliers or some could not be sent.

The existing location email enablement, sender and Resend key apply. Missing settings skip the confirmation, provider rejection is failed, and network errors or timeouts remain unconfirmed. These outcomes do not undo the saved order, clear supplier results or make the app claim delivery. The order delivery panel shows the confirmation’s status without exposing private credentials or the sender address.

The server atomically saves the order before supplier sending and saves final supplier results with a pending confirmation before calling Resend. A stable hash of the network, company, location and immutable order reference is used as the provider idempotency key. A repeated request, concurrent retry, read, restored cart result or manual history entry never sends another confirmation. An interrupted pending send is not automatically retried; check Resend before placing another order. Deletion is blocked while supplier sending or confirmation is pending so completion cannot resurrect a deleted record.

Only normal new order placement sends these emails. Existing orders are not backfilled. Viewing, editing sending settings, deleting history, importing invoices, invoice price confirmation and sales reporting never send order confirmations.
