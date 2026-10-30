# User password security

New passwords and administrator replacements require 15–256 characters. Use a
unique passphrase or a password manager. Spaces, Unicode and pasting are allowed;
there are no compulsory symbol/capital rules or routine expiry. An offline local
blocklist rejects obvious common words and variants, repeated patterns, and
passwords consisting of the user's name/email plus digits. This is not a complete
breached-password database and no password is sent to an external service.

The same server policy covers initial administrator/owner commands, local setup,
location first-user creation, employee invitations, manager password replacements,
and platform invitations. New-password forms give accessible local feedback;
existing-login forms do not reject older passwords against the new policy.

Passwords use Node's asynchronous scrypt, random 32-byte salts and 64-byte outputs.
The `scrypt-v2` profile is N=32768, r=8, p=3 (OWASP's 32 MiB alternative). Derivations
are limited to two active jobs and 32 waiters per process. Unavailable capacity
returns a retryable 503. No plaintext passwords or hashes are exposed in account
directories, client storage, audits or API responses. Private account files are
written atomically with mode 0600. Protect the persistent volume and backups too.

Legacy unversioned scrypt hashes are checked using their original parameters and
upgraded only after successful password authentication, without changing the
account version or clock PIN. A password replacement still changes the version
and invalidates old sessions. Verification rechecks account version, hash and
active state before returning, so a concurrent reset/deletion/disable cannot
issue a session with old credentials. Corrupt/unknown hash formats fail closed.

Each known account reserves a private sign-in attempt before verification. Ten
attempts without a successful sign-in restrict password authentication for 15
minutes. Username and email aliases, different connections, network-code and
automatic-discovery login share that account record; restarts retain it. A
success clears its own completed counter only if no newer attempt was reserved.
Expired restrictions clear on the next attempt; intentional password replacements
clear them too. Existing sessions and other accounts are unaffected.

An additional bounded, in-memory connection limiter reserves attempts before
asynchronous work, preventing concurrent bursts through the platform router.
Successful attempts release only their own slot, preserving other failures.
The server uses the socket address, never untrusted forwarding headers. On hosts
whose reverse proxy shares a socket address, connection limits are shared and
reset on restart; account limits remain independent and durable. Unknown accounts
get generic authentication failures and modern dummy hashing. Account lock status
can be inferred from 429 responses, as with any account-specific lockout.

This update does not add MFA, change shared kiosk/clock PIN rules, introduce email
password recovery, or rotate existing user passwords. Password throttling assumes
the current single-process service/serialized file store; multiple service replicas
need a shared transactional rate-limit/account store before horizontal scaling.

Verify with `node --test password-security.test.js` and the native account,
invitations, platform, kiosk and permission tests. Full tests can run with
`npm test -- --test-concurrency=4` to bound memory/CPU across test processes.
