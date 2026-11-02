import { Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { useApi } from '../lib/useApi'
import { get } from '../lib/api'
import { money, number, percent, dateLabel, relative } from '../lib/format'
import { Card, CardHead, PageHead, Stat, Spinner, ErrorNote, Button, Empty, BarChart, Progress } from '../components/ui'
import Icon from '../components/Icon'

const shortcuts = [
  { label: 'Place an order', to: '/', icon: 'cart' },
  { label: 'Stock count', to: '/stock-count', icon: 'clipboard' },
  { label: 'Daily sales', to: '/sales', icon: 'chart' },
  { label: 'Roster', to: '/rostering', icon: 'calendar' },
  { label: 'Comms', to: '/communications', icon: 'mail' },
  { label: 'Checklists', to: '/ops-management', icon: 'check' },
  { label: 'Labels', to: '/labels', icon: 'printer' },
  { label: 'Library', to: '/knowledge-library', icon: 'book' },
]

export default function HomePage() {
  const { session } = useSession()
  const personal = useApi(() => get('/api/home-personal'), 'personal')
  const operations = useApi(() => get('/api/home-operations'), 'operations')
  const totals = useApi(() => get('/api/home-totals'), 'totals')
  const orders = useApi(() => get('/api/home-orders'), 'orders')

  const greeting = (session?.homeGreeting || 'Hello {user}').replace('{user}', session?.username || '')
  const ops = operations.data
  const sums = totals.data
  const rows = Array.isArray(ops?.rows) ? ops.rows : []
  const chart = rows.slice(0, 12).map((row, index) => ({
    label: row.hour !== undefined ? String(row.hour) : String(index + 1),
    value: row.salesCents ?? row.forecastCents ?? row.amountCents ?? null,
  }))

  return (
    <div className="stack">
      <div className="home-hero">
        <div>
          <h1>{greeting}</h1>
          <p>
            {session?.locationName} · {dateLabel(new Date())}
          </p>
          <span className={`badge ${ops?.day?.salesCents != null ? 'badge-ok' : ''}`}>
            <Icon name="clock" size={13} />
            {ops?.day?.salesCents != null ? 'Trading data recorded today' : 'No sales recorded today yet'}
          </span>
        </div>
        <Link to="/" className="btn btn-primary">
          <Icon name="plus" size={16} />
          New order
        </Link>
      </div>

      <div className="grid grid-4">
        <Stat
          label="Recorded sales"
          value={sums ? money(sums.salesCents) : '—'}
          note={sums ? `${number(sums.recordedDays)} days recorded` : 'Loading…'}
        />
        <Stat
          label="Placed orders"
          value={sums ? money(sums.placedOrdersCents) : '—'}
          note={sums ? `${number(sums.orderCount)} orders this quarter` : 'Loading…'}
        />
        <Stat
          label="Today's sales"
          value={ops?.day?.salesCents != null ? money(ops.day.salesCents) : '—'}
          note={ops?.day?.salesCents == null ? ops?.salesReason || 'Waiting for today’s entry' : 'Entered for this trading day'}
        />
        <Stat
          label="Rostered cost today"
          value={ops?.day?.rosteredCostCents != null ? money(ops.day.rosteredCostCents) : '—'}
          note={ops?.day?.rosteredCostReason || 'From the published roster'}
        />
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHead
            title="Today at a glance"
            subtitle={ops ? `${ops.locationName} · ${ops.timeZone || 'Australia/Melbourne'}` : undefined}
            actions={<Link className="btn btn-sm btn-ghost" to="/sales">Open sales</Link>}
          />
          <div className="card-pad">
            {operations.loading ? <Spinner /> : null}
            <ErrorNote error={operations.error} onRetry={operations.reload} />
            {ops ? (
              <div className="stack">
                <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div className="stat-label">This hour forecast</div>
                    <div style={{ fontSize: 22, fontWeight: 650 }}>{money(ops.current?.salesCents)}</div>
                  </div>
                  <div>
                    <div className="stat-label">Through to now</div>
                    <div style={{ fontSize: 22, fontWeight: 650 }}>{money(ops.current?.throughSalesCents)}</div>
                  </div>
                  <div>
                    <div className="stat-label">Hour</div>
                    <div style={{ fontSize: 22, fontWeight: 650 }}>
                      {ops.current?.hour != null ? `${ops.current.hour}:00` : '—'}
                    </div>
                  </div>
                </div>
                {chart.length ? <BarChart data={chart} format={money} /> : null}
                {ops.salesReason ? <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>{ops.salesReason}</p> : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHead title="Ordering budget" subtitle="Original and updated projections" actions={<Link className="btn btn-sm btn-ghost" to="/">Review</Link>} />
          <div className="card-pad stack">
            {totals.loading ? <Spinner /> : null}
            <ErrorNote error={totals.error} onRetry={totals.reload} />
            {sums ? (
              <>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="stat-label">Placed this quarter</span>
                  <strong>{money(sums.quarterPlacedOrdersCents)}</strong>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="stat-label">Transfer costs</span>
                  <strong>{money(sums.quarterTransferCostCents)}</strong>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="stat-label">Expenses share</span>
                  <strong>{percent(sums.expensePercent)}</strong>
                </div>
                <div>
                  <Progress value={sums.expensePercent || 0} max={100} tone={(sums.expensePercent || 0) > 35 ? 'warn' : ''} />
                  <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 8 }}>
                    Averaged across {number(sums.averages?.weeksRecorded)} completed weeks.
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHead title="Your work" subtitle="Tasks and reading that need you" actions={<Link className="btn btn-sm btn-ghost" to="/ops-management">Checklists</Link>} />
          <div className="card-pad">
            {personal.loading ? <Spinner /> : null}
            <ErrorNote error={personal.error} onRetry={personal.reload} />
            {personal.data ? (
              <div className="stack">
                <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
                  <span className="badge badge-primary">{number(personal.data.tasks?.total)} open tasks</span>
                  <span className="badge">{number(personal.data.comms?.unreadMessages)} unread messages</span>
                  <span className="badge">{number(personal.data.comms?.unreadPosts)} unread posts</span>
                </div>
                {(personal.data.tasks?.items || []).slice(0, 4).map((task) => (
                  <div className="list-row" key={task.id || task.name} style={{ paddingLeft: 0, paddingRight: 0 }}>
                    <Icon name="check" size={16} />
                    <div className="list-main">
                      <strong>{task.name || task.title}</strong>
                      <small>{task.locationName || task.due || ''}</small>
                    </div>
                  </div>
                ))}
                {!(personal.data.tasks?.items || []).length ? (
                  <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>Nothing open for you right now.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHead title="Recent orders" subtitle="Latest placed from this location" actions={<Link className="btn btn-sm btn-ghost" to="/order-history">History</Link>} />
          <div className="card-pad">
            {orders.loading ? <Spinner /> : null}
            <ErrorNote error={orders.error} onRetry={orders.reload} />
            {Array.isArray(orders.data?.orders) && orders.data.orders.length ? (
              orders.data.orders.slice(0, 5).map((order) => (
                <div className="list-row" key={order.id} style={{ paddingLeft: 0, paddingRight: 0 }}>
                  <div className="list-main">
                    <strong>{order.orderNumber || order.id}</strong>
                    <small>
                      {relative(order.createdAt)} · {number(order.items?.length)} items
                    </small>
                  </div>
                  <strong>{money(order.total)}</strong>
                </div>
              ))
            ) : (
              !orders.loading && <Empty title="No orders yet">Place your first order from the ordering page.</Empty>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Popular shortcuts" />
        <div className="card-pad">
          <div className="quick-grid">
            {shortcuts.map((shortcut) => (
              <Link className="quick" to={shortcut.to} key={shortcut.to}>
                <Icon name={shortcut.icon} size={17} />
                {shortcut.label}
              </Link>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
