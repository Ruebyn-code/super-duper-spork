import { get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { number } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Notice, PageHead, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'
import { Link } from 'react-router-dom'

export default function LocationSetupPage() {
  const { session, switchLocation } = useSession()
  const setup = useApi(() => get('/api/location-setup'), 'setup')
  const data = setup.data
  const locations = data?.locations || []
  const pending = locations.filter((location) => location.setupPending !== false && !location.completedAt)

  return (
    <div className="stack">
      <PageHead title="Location setup" description="Nine guided tasks per location: name, state, hours, manager, first user, employer, ordering email, target levels and a kiosk.">
        <Button size="sm" variant="ghost" icon="refresh" onClick={setup.reload}>
          Refresh
        </Button>
      </PageHead>

      <div className="grid grid-4">
        <Stat label="Pending locations" value={number(data?.pendingCount)} />
        <Stat label="Tracked locations" value={number(locations.length)} />
        <Stat label="Blocked" value={data?.blocked ? 'Yes' : 'No'} />
        <Stat label="Reminder" value={data?.reminderDue ? 'Due' : 'Not due'} />
      </div>

      {data?.snoozedUntil ? (
        <Notice tone="info">
          <Icon name="clock" size={17} />
          <span>Setup reminders are snoozed until {new Date(data.snoozedUntil).toLocaleString('en-AU')}.</span>
        </Notice>
      ) : null}

      <ErrorNote error={setup.error} onRetry={setup.reload} />
      {setup.loading ? <Spinner label="Loading setup status" /> : null}

      <Card>
        <CardHead title="Locations" subtitle="Setup progress for this company" />
        {!setup.loading && !locations.length ? (
          <Empty title="Nothing to set up">Every location has completed its setup tasks.</Empty>
        ) : null}
        {locations.map((location) => (
          <div className="list-row" key={location.id}>
            <Icon name="building" size={17} />
            <div className="list-main">
              <strong>{location.name}</strong>
              <small>{location.setupPending === false ? 'Setup complete' : 'Setup in progress'}</small>
            </div>
            {pending.some((entry) => entry.id === location.id) ? (
              <Button size="sm" onClick={() => switchLocation(location.id)}>
                Work on this location
              </Button>
            ) : (
              <span className="badge badge-ok">Complete</span>
            )}
          </div>
        ))}
      </Card>

      <Card>
        <CardHead title="Guided steps" subtitle="Each step edits only its own popup form" />
        <div className="card-pad">
          <div className="quick-grid">
            {['Name', 'State', 'Trading hours', 'Manager', 'First user', 'Employer setup', 'Ordering email', 'Target levels', 'Kiosk'].map((step) => (
              <span className="quick" key={step} style={{ cursor: 'default' }}>
                <Icon name="check" size={15} />
                {step}
              </span>
            ))}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 14 }}>
            Setup is non-blocking: operational screens keep working while tasks are outstanding. Location details are edited in
            <Link to="/admin" style={{ color: 'var(--primary)' }}> Suppliers &amp; stock → Locations</Link>.
          </p>
        </div>
      </Card>

      <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Signed in at {session?.locationName}.</p>
    </div>
  )
}
