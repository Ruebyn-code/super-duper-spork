import { useMemo, useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { money, number, dateLabel } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Notice, PageHead, Spinner, Stat, Tabs } from '../components/ui'
import Icon from '../components/Icon'

const shiftWeek = (start, weeks) => {
  const date = new Date(`${start}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return date.toISOString().slice(0, 10)
}
const mondayOf = () => {
  const now = new Date()
  const day = (now.getUTCDay() + 6) % 7
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - day)
  return monday.toISOString().slice(0, 10)
}

export default function RosteringPage() {
  const { session, can } = useSession()
  const [week, setWeek] = useState('')
  const [view, setView] = useState('team')
  const roster = useApi(() => get(`/api/rostering/dashboard${week ? `?week=${week}` : ''}`), week)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const data = roster.data
  const start = data?.weekStart || week || mondayOf()
  const shifts = view === 'team' ? data?.teamRoster?.shifts || [] : data?.roster?.shifts || []
  const timesheets = Array.isArray(data?.timesheets) ? data.timesheets : []

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${start}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + index)
        return date.toISOString().slice(0, 10)
      }),
    [start],
  )

  async function publish() {
    if (!data?.roster) return
    if (!window.confirm('Publish this week’s roster? Staff will see the published shifts.')) return
    setBusy(true)
    setError('')
    try {
      await post('/api/rostering/publish', { weekStart: data.weekStart, revision: data.roster.revision })
      roster.reload()
    } catch (problem) {
      setError(problem.message || 'Could not publish the roster.')
    } finally {
      setBusy(false)
    }
  }

  async function copyPrevious() {
    setBusy(true)
    setError('')
    try {
      await post('/api/rostering/copy-previous', { weekStart: start })
      roster.reload()
    } catch (problem) {
      setError(problem.message || 'Could not copy the previous week.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageHead title="Rostering" description={`${session?.locationName || ''} · published shifts and this week’s timesheets.`}>
        <Button onClick={() => setWeek(shiftWeek(start, -1))}>Previous</Button>
        <Button onClick={() => setWeek(shiftWeek(start, 1))}>Next</Button>
        {can('rostering.manage') ? (
          <>
            <Button onClick={copyPrevious} disabled={busy}>
              Copy last week
            </Button>
            <Button variant="primary" onClick={publish} disabled={busy || !data?.roster}>
              Publish week
            </Button>
          </>
        ) : null}
      </PageHead>

      {error ? (
        <Notice tone="danger">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </Notice>
      ) : null}

      <div className="grid grid-4">
        <Stat label="Week" value={dateLabel(start, { day: 'numeric', month: 'short' })} note={`to ${dateLabel(days[6], { day: 'numeric', month: 'short' })}`} />
        <Stat label="Published shifts" value={number(data?.teamRoster?.shifts?.length || 0)} note="Visible to staff" />
        <Stat label="Draft shifts" value={number(data?.roster?.shifts?.length || 0)} note={data?.roster?.hasChanges ? 'Unpublished changes' : 'Matches published'} />
        <Stat label="Timesheets" value={number(timesheets.length)} note="Recorded entries this week" />
      </div>

      <Card>
        <CardHead
          title="Schedule"
          subtitle={data ? `${dateLabel(start)} — ${dateLabel(days[6])}` : 'Loading roster'}
          actions={
            <div className="row">
              <Tabs
                value={view}
                onChange={setView}
                options={[
                  { value: 'team', label: 'Published' },
                  { value: 'draft', label: 'Draft' },
                ]}
              />
              <Button size="sm" variant="ghost" icon="refresh" onClick={roster.reload}>
                Refresh
              </Button>
            </div>
          }
        />
        {roster.loading ? <Spinner label="Loading roster" /> : null}
        <ErrorNote error={roster.error} onRetry={roster.reload} />
        {!roster.loading && data ? (
          <div className="card-pad stack">
            {days.map((day) => {
              const dayShifts = shifts.filter((shift) => shift.date === day)
              return (
                <div key={day}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <strong style={{ fontSize: 13.5 }}>{dateLabel(day, { weekday: 'long', day: 'numeric', month: 'short' })}</strong>
                    {day === data.today ? <span className="badge badge-primary">Today</span> : null}
                    <span className="badge">{number(dayShifts.length)} shifts</span>
                  </div>
                  {!dayShifts.length ? (
                    <p style={{ color: 'var(--muted)', fontSize: 13, padding: '4px 0 10px' }}>No shifts</p>
                  ) : (
                    dayShifts.map((shift) => (
                      <div className="list-row" key={shift.id} style={{ paddingLeft: 0, paddingRight: 0 }}>
                        <span
                          className="badge"
                          style={{ background: shift.colour ? `${shift.colour}22` : undefined, color: shift.colour || undefined }}
                        >
                          {shift.position || 'Shift'}
                        </span>
                        <div className="list-main">
                          <strong>{shift.username || (shift.userId ? 'Staff' : 'Vacant')}</strong>
                          <small>
                            {shift.start} – {shift.end}
                            {shift.overnight ? ' (next day)' : ''} · {number(shift.breakMinutes)} min break
                          </small>
                        </div>
                        {shift.publication ? <span className={`badge ${shift.publication.state === 'published' ? 'badge-ok' : ''}`}>{shift.publication.state}</span> : null}
                        {can('rostering.costs') && shift.costCents != null ? <strong>{money(shift.costCents)}</strong> : null}
                      </div>
                    ))
                  )}
                </div>
              )
            })}
            {!shifts.length ? <Empty title="No shifts this week">Copy the previous week or build shifts to get started.</Empty> : null}
          </div>
        ) : null}
      </Card>

      {timesheets.length ? (
        <Card>
          <CardHead title="Timesheets" subtitle="Recorded clock-ins and manual entries" />
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Break</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.username || entry.userName || '—'}</td>
                    <td>{entry.workDate ? dateLabel(entry.workDate) : '—'}</td>
                    <td>
                      <span className={`badge ${entry.status === 'approved' ? 'badge-ok' : ''}`}>{entry.status || 'recorded'}</span>
                    </td>
                    <td className="num">{entry.breakMinutes != null ? `${number(entry.breakMinutes)} min` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
