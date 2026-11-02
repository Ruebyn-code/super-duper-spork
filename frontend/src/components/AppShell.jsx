import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { useCart } from '../context/CartContext'
import { navGroups, titleFor } from './navigation'
import Icon from './Icon'
import { initials } from '../lib/format'

function LocationSwitcher({ session, switchLocation }) {
  const [busy, setBusy] = useState(false)
  if (!session?.locations?.length) return null
  return (
    <label className="select-inline">
      <Icon name="building" size={15} />
      <select
        aria-label="Selected location"
        value={session.locationId || ''}
        disabled={busy || session.kiosk}
        onChange={async (event) => {
          setBusy(true)
          try {
            await switchLocation(event.target.value)
          } finally {
            setBusy(false)
          }
        }}
      >
        {session.locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function CompanySwitcher({ session, switchCompany }) {
  const [busy, setBusy] = useState(false)
  if (!session?.companies || session.companies.length < 2) return null
  return (
    <label className="select-inline desktop-only">
      <select
        aria-label="Selected company"
        value={session.companyId || ''}
        disabled={busy}
        onChange={async (event) => {
          setBusy(true)
          try {
            await switchCompany(event.target.value)
          } finally {
            setBusy(false)
          }
        }}
      >
        {session.companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function AppShell() {
  const { session, signOut, switchLocation, switchCompany, theme, setTheme, can } = useSession()
  const { count } = useCart()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = `${titleFor(location.pathname)} · Opstack`
  }, [location.pathname])

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || can(item.permission)),
    }))
    .filter((group) => group.items.length)

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <NavLink to="/home" className="brand">
          <img src="/favicon.png" alt="" />
          Opstack<span>.</span>
        </NavLink>
        <div className="sidebar-scroll">
          {visibleGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name={item.icon} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  {item.to === '/cart' && count > 0 ? <span className="nav-badge">{count}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-foot">
          <button type="button" className="user-chip" onClick={() => navigate('/settings')}>
            <span className="avatar">
              {session?.photoUrl ? <img src={session.photoUrl} alt="" /> : initials(session?.username)}
            </span>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 13.5 }}>{session?.username}</strong>
              <small>{session?.roleName}</small>
            </span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumbs desktop-only">
            {session?.companyName ? <span>{session.companyName} · </span> : null}
            <strong>{titleFor(location.pathname)}</strong>
          </div>
          <div className="spacer" />
          <LocationSwitcher session={session} switchLocation={switchLocation} />
          <CompanySwitcher session={session} switchCompany={switchCompany} />
          <button
            type="button"
            className="icon-btn"
            aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
            title={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
          <button type="button" className="icon-btn" aria-label="Cart" title="Cart" onClick={() => navigate('/cart')}>
            <Icon name="cart" size={17} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}
          >
            <Icon name="logout" size={17} />
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PageShell({ children }) {
  return <div className="stack">{children}</div>
}
