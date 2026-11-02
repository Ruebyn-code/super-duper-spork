# Phase 1 — Foundations (rebuild)

Phase 1 rebuilds the layer every later phase depends on: who someone is, which
company and locations they can reach, what they are allowed to do, and one
scope check that every write passes through.

It runs **beside** the current app rather than replacing it, so nothing in the
live product changes while parity work proceeds:

| | Current app | Rebuild |
| --- | --- | --- |
| Command | `node server.js` | `node rebuild/server.js` |
| Host port | 3000 | 3001 (own preview tab) |
| Session cookie | `admin_session` | `rebuild_session` |
| Records | `./data` | `rebuild/data` (gitignored) |
| Auth | `auth.js` scrypt sessions | `rebuild/sessions.js` over the same password modules |

## What is reused, not rewritten

Parity depends on sharing the rules that already exist, not re-deriving them:

- `public/password-policy.js` + `password-security.js` — scrypt v2 hashing,
  policy validation, attempt limits, legacy-hash upgrades.
- `public/permission-model.js` — the whole catalogue: **63 feature grants and
  41 optional action limits** (`permissions.keys.length` / `permissions.actionKeys.length`,
  asserted by the tests), including `can`, `grants` and `canAssign`.
- `account-invitations.js` — single-use, 48-hour setup tokens stored only as
  SHA-256 hashes; the raw token is never written to records or logs.

## What is new

| File | Purpose |
| --- | --- |
| `rebuild/store.js` | Entity collections: one JSON array per file, atomic `0600` writes, per-collection write queue |
| `rebuild/permissions.js` | The permission model plus company/location scoping (`companyAllowed`, `locationAllowed`, `accessibleLocations`) |
| `rebuild/access.js` | `write()` — the one scope check every rebuilt write path calls |
| `rebuild/accounts.js` | Sign-in, user listing, invitations, acceptance, session revocation |
| `rebuild/sessions.js` | 8-hour tokens, per-session CSRF secret, version-bound revocation |
| `rebuild/locations.js` | Scoped reads and guarded location creation |
| `rebuild/audit.js` | Bounded append-only activity trail |
| `rebuild/server.js` | Server-rendered pages: sign-in, Home, Users, Locations, invitation acceptance, `/healthz` |
| `rebuild/views.js`, `rebuild/public/rebuild.css` | Markup and mobile-first styles |
| `rebuild/seed.js` | Idempotent demo data: two companies, three locations, three accounts |
| `rebuild/test/foundations.test.js` | 10 gate tests |

## Gate: evidence

The Phase 1 gate is *"a user signs in and sees only their company and location
data; a delegated limited manager cannot exceed their granted actions."*

`docker compose -f docker-compose.base44.yml run --rm --no-deps rebuild node --test rebuild/test/foundations.test.js` — 10/10 passing, each on its own temporary data directory:

- catalogue still holds 63 grants and 41 action limits and three default levels
- wrong password and unknown email are rejected; the seeded password signs in
- a session dies when the account's version changes
- Harbour users list only Harbour locations and only Harbour users; Riverside
  users see nothing of Harbour
- the limited manager has `users.manage` but not `users.create`, so inviting is
  refused (403) while Head Office can invite
- a setup token works once, cannot sign in before activation, is never stored
  in plaintext, and enforces the password policy
- a write cannot cross into another company (404 for company and location), and
  a location write needs both the grant and the company scope

Checked over HTTP on the running service (cookie jar, real forms):

- `admin@harbour.test` → Home shows Harbour Group, 2 locations, 104/104 permissions
- `manager@harbour.test` → 1 location, no invite form, forced invite POST → 403
- `admin@riverside.test` → Riverside Store only
- invite → one-time setup link → accept → single-use enforced → new account signs in and sees only its location
- Sign out everywhere → the old cookie is redirected to sign-in

## Demo accounts

Seeded only when `rebuild/data` has no companies. Password for all three:
`harbour-demo-passphrase` (override with `REBUILD_DEMO_PASSWORD`).

| Email | Scope |
| --- | --- |
| `admin@harbour.test` | Head Office · Harbour Group, both stores |
| `manager@harbour.test` | Franchisee · Harbour Street only, `users.create` denied |
| `admin@riverside.test` | Head Office · Riverside Group (different company) |

## Deliberate Phase 1 limits

- **Invitation delivery is the manager, not email.** There is no email provider
  in the rebuild yet, so the inviter is shown the one-time setup link once, and
  only when `BASE44_PREVIEW_MODE=1`. Unset, the invitation is still created but
  no link is rendered.
- **Three built-in permission levels only.** Creating and editing company
  permission levels is not built yet; the catalogue and `canAssign` hierarchy it
  will use are already in place.
- **No company creation, user removal, deactivation or email changes yet.**
- **Server-rendered pages, no browser bundle.** Later phases add interactive
  surfaces on the same session and scope model.
- **No required-reading gate.** That belongs to Phase 6's Comms work.

## Next

Phase 2 (ordering and stock) starts from `rebuild/access.js`: every write in
catalogue, cart, counts, transfers and wastage resolves its company/location
through the same guard before touching a record.
