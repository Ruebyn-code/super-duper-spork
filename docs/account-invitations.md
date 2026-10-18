# Account setup emails

An authorised Head Office user configures **Settings → Account emails** once for the entire Opstack network:

1. Enter the sender email address on a domain verified in Resend.
2. Add the Resend API key, enable account setup emails and save.
3. In **Users**, create a user with their name, email, permissions and locations. Opstack sends an invitation from the shared sender.
4. The recipient opens the email, chooses and confirms a password, then signs in with their email.

Links expire after 48 hours and can be used once. They remain valid across restarts. Pending users cannot sign in before completing setup. Open a pending user’s edit controls to resend an invitation; resending replaces the old link. Failed emails can be retried after correcting the shared sender settings.

Users with **Manage users** can invite people only within their existing permission hierarchy and location access. **Edit user emails** controls changes to existing sign-in emails; Head Office has this by default. Changing a pending user’s email invalidates their old link, so resend the invitation afterward. Existing passwords and username sign-ins continue to work.

**Account invitation email** is a network permission controlling the shared sender. Companies and locations cannot override it. Sender credentials are stored in `account-email-settings.json` on the persistent data volume; API responses expose only whether a key is saved. Invitation tokens are hashed in `accounts.json`; raw tokens are sent only in the email and submitted setup request. Production links use `APP_ORIGIN`.

Provider acceptance is displayed separately from a failed or unconfirmed send. Check the email service after an unconfirmed send before resending. This setup does not send test emails automatically.
