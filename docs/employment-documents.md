# Employment agreements and account onboarding

In Users → edit staff → Pay Conditions, Employment documents selects reviewed
contracts, IFAs or both. The same panel is available in the new-user setup’s
Roster details step. Save account and employment changes first. Names, email,
phone, location, legal employer, state, dates, employment type, classification,
regular hours and available native hourly rates fill from saved records. Rates
are dated to the agreement’s selected effective date; unavailable rates and other
missing required fields block sending instead of becoming guessed values.

Edit contract & IFA templates opens an email-style template editor with field
insertion and a live staff/example preview. Shared templates are company-scoped
and require users.manage, awards.manage and locations.all to edit. Authorised
location managers can use Ready templates for staff they can manage. Templates
keep Draft/Ready/Archived states and private revisions; edited terms need review
again. No legal terms are generated or supplied as automatically approved text.
Archive retains issued documents and template history.

Review selected documents is read-only. Send selected documents rechecks saved
staff, pay, employer and template details against the reviewed snapshot, fixes
all selected documents atomically and reserves each invitation before provider
calls. Nothing is sent by selecting templates, opening previews or saving pay.
Uncertain responses freeze the same retry payload; retries cannot duplicate
documents or invitations. Each issued source retains its template ID, revision
and content digest; future edits or archival never change issued copies or
signatures. Account-only signing, independent legal review and the existing
single-document drafting workflow below remain available.

Open My agreements from the blue account dropdown. A manager with users.manage
and awards.manage can prepare agreements only for employees they can manage at
an accessible trading location. Employee, employer representative and any guardian
are distinct existing OpStack accounts with distinct email addresses. Invite new
accounts through the native Users flow; pending invitees cannot sign until they
activate their account and choose a password. Use a suitably limited permission
level for guardian accounts. Support impersonation and paired kiosks cannot use
this signing feature.

Prepare reviewed plain text, with legal names, employer location, state/territory,
dates and an explicit legal/employment review reference. This version does not
accept PDF uploads or interpret contract terms. It supports ordinary agreements,
not deeds, witnessing, powers of attorney, statutory declarations or special
company execution. The issuer attests review and authority; no app action
certifies lawfulness or a better-off-overall assessment. Legal review must cover
applicable Commonwealth and state/territory electronic-transactions requirements,
Fair Work/award obligations and the particular document. The official legislation
site was inaccessible from this development environment; current-law verification
and template approval remain outstanding business/legal checks.

Save draft is private and sends nothing. Only Review and send → Send for
signatures freezes the document and reserves email attempts. The sender is the
existing platform Account setup emails configuration. Production requires a
configured public HTTPS APP_ORIGIN. The email link contains a document UUID,
not a signing credential: authentication and named-party access are mandatory.
Email delivery acceptance, failure and uncertainty are distinct. Reads, retries
and restarts never resend an uncertain message; explicit invitations may be
resent. A draft’s named issuing representative alone may edit it. Preparing a
revised version creates a separate request and never voids a signed contract.

After account activation, login directs employees with pending signatures into
onboarding. Outstanding signatures also appear in their personal Home work.
This is a personal onboarding task, not a company-wide operational block. The
onboarding Continue action asks the employee to resolve their signatures; decline
and paper requests are genuine alternatives to electronic consent. Other signers
open their private assigned document from its email or My agreements.

Automatic clock prompts are deferred on the agreement page so they cannot interrupt review; the manual clock button remains available.

The full document is readable/downloadable before deciding. Every signature
requires a new explicit email-code request and verification, with a ten-minute
code, five-attempt persistent limit, one-minute resend cooldown and ten requests
per account per fifteen minutes. Only hashes/salts are stored. Verified signing
authority is bound to the current authenticated session, party and document,
expires after fifteen minutes and never signs on its own. The signer types the
legal name and explicitly confirms electronic consent and intention/capacity,
then confirms the signature against the issued document hash. IFAs cannot be
signed before the recorded employment commencement date; each signer also
attests actual commencement. Under-18 IFAs require a separately named guardian
account and signature. This does not establish the guardian relationship or
substitute for independent identity checks appropriate to higher-risk documents.

Issued content and completed evidence are immutable. Signatures retain account
and verified email, role, exact consent/intention, recorded server UTC time,
document digest, connection address and bounded user agent. Connection address
is the server-observed socket address, not an assumed end-user IP behind proxies.
Events use a SHA-256 chain; completed snapshots retain their own digest and
original events. Integrity checks reject changed content or signatures. These
checks are tamper-evident, not an independent trusted timestamp or protection
against an administrator rewriting all storage. Copies emailed to parties carry
the final digests as independent comparison records.

All parties can download a self-contained UTF-8 HTML copy and JSON signing record;
HTML is escaped and can be printed/saved as PDF in the browser. On completion,
individual completed copies are emailed without exposing other accounts or
provider keys. In-app copies remain available if email delivery fails. Native
queues reserve attempts before paid provider calls and retain unknown outcomes.
Signed records are never deleted through this feature; completed records include
a seven-year minimum-retention marker, not an automatic deletion schedule. The
business must assess any longer retention and access obligations, arrange
backups and appropriate storage controls, and retain paper counterparts outside
this flow when used. Full authorised owners retain scoped access to records after
an employee or location is removed/archived.

No signing action configures employers, changes employee pay profiles, applies
IFA exemptions, creates shifts, grants permission levels or updates payroll.
Existing signed IFA references remain separate; only an explicitly recorded and
properly reviewed supported agreement can affect the existing award calculator.

Verification uses synthetic data and fake email providers only. Tests cover the
account-invitation activation gate, native CSRF/scope/kiosk privacy, exact consent
and source hashes, session-bound code verification, attempt/expiry persistence,
concurrent signatures, retries/unknown delivery, guardian signatures, refusal,
read-only copies, integrity failures, frozen approvals and ordinary native flows.
