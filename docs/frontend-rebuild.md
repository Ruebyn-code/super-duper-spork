# Rebuilt frontend (React + Vite)

The browser UI was rebuilt as a React single-page app in `frontend/`. The existing
Node service is unchanged: it still owns every `/api/*` route, session cookie,
CSRF check, permission and piece of business logic. This document records how the
two fit together and what each screen is wired to.

## Why this shape

- 29 screens share one shell, navigation, permission filter and design system, so
  they are one React app with a client router rather than 29 HTML documents.
- Keeping the Node API in place means ordering, stock, sales, rosters, award rules
  and reporting behaviour do not change — only the interface that calls them.
- Vite serves the SPA on the single preview origin (host port 3000) and proxies
  `/api`, `/fonts`, `/assets`, `/favicon.png`, `/logo`, `/appearance`,
  `/interface-text`, `/element-overrides` and `/layouts` to the Node service on
  `app:3001`. Cookies (`SameSite=Strict; Secure`) and the `Origin` comparison in
  `opstack-router.js` therefore keep working without CORS.

## Running it

```sh
docker compose -f docker-compose.base44.yml up -d
curl http://localhost:3000/            # Vite HTML shell
curl http://localhost:3000/healthz     # proxied Node health check
```

- `web` — Vite dev server, live reload, `frontend/` bind-mounted,
  dependencies installed into the `frontend_modules` volume.
- `app` — Node backend on 3001, data in the `opstack-data` volume.
- Frontend production build check: `docker compose ... exec -T web npm run build`.

## Structure

```
frontend/src/
  main.jsx, App.jsx          provider + router, protected-route gate
  lib/api.js                 fetch wrapper: CSRF header, X-Location-Id, 428 gate
  lib/useApi.js              small fetch-on-change hook
  lib/format.js              money/date/percent helpers (Australia/Melbourne)
  context/SessionContext.jsx session, location/company switch, appearance, theme
  context/CartContext.jsx    cart persisted per user + location
  components/AppShell.jsx    sidebar, location switcher, theme, sign out
  components/ui.jsx          Card, Button, Field, Modal, Stat, BarChart, …
  pages/*.jsx                one file per screen
```

Company styling is read from `GET /appearance` and written onto `:root` as
`--primary` / `--secondary`; the stylesheet derives every surface from those
tokens and supports a light and dark theme (the toggle is persisted per browser).

## Screens and their APIs

| Route | Screen | Data |
| --- | --- | --- |
| `/` | Ordering | `GET /api/menu`, cart in browser, `POST /api/orders` from the cart |
| `/home` | Home | `/api/home-personal`, `/api/home-operations`, `/api/home-totals`, `/api/home-orders` |
| `/cart` | Cart | catalogue lookup + `POST /api/orders` |
| `/order-history` | Order history | `GET /api/order-history`, detail by id |
| `/stock-count` | Stock count | `GET /api/menu`, `GET/POST /api/stock-counts`, detail by id |
| `/stock-transfers` | Transfers | `GET/POST /api/stock-transfers`, `/options`, receive by id |
| `/wastage` | Wastage | `GET /api/wastage?from&to`, `/options`, `POST /api/wastage`, void by id |
| `/sales` | Sales | `GET/PUT /api/sales` (week, days in cents, revision) |
| `/reporting` | Reporting | `GET /api/reporting?preset=` |
| `/rostering` | Rostering | `GET /api/rostering/dashboard`, publish/copy actions |
| `/communications` | Comms | `/posts`, `/threads`, `/unread`, read receipts, post creation |
| `/ops-management` | Checklists | `GET /api/ops-management`, start run |
| `/learning-centre` | Learning | `GET /api/learning-centre` |
| `/knowledge-library` | Library | `GET/POST /api/knowledge-library`, article by id |
| `/employment-documents` | Documents | `GET /api/employment-documents` |
| `/labels` | Labels | `GET /api/prep-labels` |
| `/admin` | Suppliers & stock | `GET /api/catalogue`, `/api/locations` |
| `/admin/accounts` | Accounts | `GET /api/accounts`, `/api/permission-levels`, invite via `POST /api/accounts` |
| `/admin/settings` | App settings | `GET /appearance`, full `PUT /api/settings`, `GET /api/interface-text` |
| `/settings` | Settings hub | session, location switch, theme |
| `/settings/awards` | Award settings | `GET /api/awards` |
| `/settings/devices` | Kiosk devices | `GET/POST /api/kiosk-devices` |
| `/location-setup-step` | Location setup | `GET /api/location-setup` |
| `/kiosk` | Kiosk | `GET /api/kiosk/status`, `POST /api/kiosk/unlock` |
| `/opstack` | Opstack console | `GET /api/opstack/session`, console login |
| `/login`, `/setup`, `/accept-invite` | Auth | `POST /api/login`, `/api/setup`, `/api/invitations/*` |

## Behaviour worth remembering

- `POST`/`PUT`/`DELETE` calls need `x-csrf-token` from `GET /api/session`; several
  read endpoints check it too, so `lib/api.js` sends it whenever present.
- Location-scoped endpoints read `X-Location-Id`; the switcher updates it after
  `PUT /api/session/location`.
- Required-reading responses (`428`, `code: REQUIRED_POSTS`) route the user to
  Communications instead of showing a raw error.
- Appearance saves are full `PUT /api/settings` writes because `PATCH` only accepts
  fonts/backgrounds/surface style, not colours.

## Known gaps in this first pass

These screens deliberately show read-only state today; their deep editors still
live in the original pages under `public/`:

- stock item editor (pack units, ordering rules, manual targets)
- roster shift editor, timesheet review and award previews
- checklist builder/runner, learning course builder, knowledge library rich editor
- label designer and batch printing
- employment document templates and signing
- Opstack console billing and monthly reports
