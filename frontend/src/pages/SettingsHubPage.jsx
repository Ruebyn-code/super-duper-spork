import { Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { Button, Card, CardHead, PageHead } from '../components/ui'
import Icon from '../components/Icon'

export default function SettingsHubPage() {
  const { session, theme, setTheme, switchLocation, signOut } = useSession()

  return (
    <div className="stack">
      <PageHead title="Settings" description="Your account, the selected location and company-wide administration." />

      <div className="grid grid-2">
        <Card>
          <CardHead title="Your account" subtitle={session?.roleName} />
          <div className="card-pad stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="stat-label">Name</span>
              <strong>{session?.username}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="stat-label">Company</span>
              <strong>{session?.companyName}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="stat-label">Location</span>
              <strong>{session?.locationName}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="stat-label">Theme</span>
              <Button size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                Use {theme === 'dark' ? 'light' : 'dark'} theme
              </Button>
            </div>
            <div>
              <Button size="sm" variant="ghost" icon="logout" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Switch location" subtitle="Changes every location-scoped screen" />
          <div className="card-pad stack">
            {(session?.locations || []).map((location) => (
              <button
                type="button"
                key={location.id}
                className="list-row"
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: location.id === session.locationId ? 'var(--surface-3)' : 'transparent',
                  textAlign: 'left',
                }}
                onClick={() => switchLocation(location.id)}
              >
                <Icon name="building" size={17} />
                <div className="list-main">
                  <strong>{location.name}</strong>
                  <small>{location.id === session.locationId ? 'Currently selected' : 'Tap to switch'}</small>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Administration" subtitle="Company-wide settings" />
        <div className="card-pad">
          <div className="quick-grid">
            <Link className="quick" to="/admin/settings">
              <Icon name="settings" size={17} />
              App appearance
            </Link>
            <Link className="quick" to="/admin/accounts">
              <Icon name="users" size={17} />
              Accounts
            </Link>
            <Link className="quick" to="/settings/awards">
              <Icon name="star" size={17} />
              Award settings
            </Link>
            <Link className="quick" to="/settings/devices">
              <Icon name="phone" size={17} />
              Kiosk devices
            </Link>
            <Link className="quick" to="/location-setup-step">
              <Icon name="clipboard" size={17} />
              Location setup
            </Link>
            <Link className="quick" to="/help">
              <Icon name="bookOpen" size={17} />
              Help & support
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
