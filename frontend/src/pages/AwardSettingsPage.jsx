import { get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { number, dateLabel } from '../lib/format'
import { Card, CardHead, ErrorNote, Notice, PageHead, Progress, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'

export default function AwardSettingsPage() {
  const { session } = useSession()
  const awards = useApi(() => get('/api/awards'), 'awards')
  const overview = awards.data?.overview
  const locations = overview?.locations || []

  const readyEmployers = locations.filter((location) => location.employer?.ready).length
  const readyPeople = locations.reduce((sum, location) => sum + (location.team?.ready || 0), 0)
  const totalPeople = locations.reduce((sum, location) => sum + (location.team?.total || 0), 0)

  return (
    <div className="stack">
      <PageHead title="Award settings" description={`${session?.companyName || ''} · employer, employee and public holiday readiness for award calculations.`} />

      <div className="grid grid-4">
        <Stat label="Employers ready" value={`${number(readyEmployers)} / ${number(locations.length)}`} />
        <Stat label="Employees ready" value={`${number(readyPeople)} / ${number(totalPeople)}`} />
        <Stat label="Award year" value={number(overview?.year)} />
        <Stat label="Review date" value={overview?.date ? dateLabel(overview.date) : '—'} />
      </div>

      {overview?.sourceReviewRequired ? (
        <Notice tone="warn">
          <Icon name="alert" size={17} />
          <span>The published award source needs review before rates can be certified.</span>
        </Notice>
      ) : null}

      <ErrorNote error={awards.error} onRetry={awards.reload} />
      {awards.loading ? <Spinner label="Loading award settings" /> : null}

      <div className="grid grid-2">
        {locations.map((location) => {
          const team = location.team || {}
          const employer = location.employer || {}
          return (
            <Card key={location.id}>
              <CardHead
                title={location.name}
                subtitle={employer.name || 'Employer not configured'}
                actions={<span className={`badge ${employer.ready ? 'badge-ok' : 'badge-warn'}`}>{employer.ready ? 'Ready' : 'Setup needed'}</span>}
              />
              <div className="card-pad stack">
                <div>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="stat-label">Employees ready</span>
                    <strong>
                      {number(team.ready)} / {number(team.total)}
                    </strong>
                  </div>
                  <Progress value={team.ready} max={team.total || 1} />
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="stat-label">Public holidays</span>
                  <span className={`badge ${location.holidays?.ready ? 'badge-ok' : ''}`}>
                    {location.holidays?.ready ? 'Reviewed' : location.holidays?.state || 'Not reviewed'}
                  </span>
                </div>
                {!employer.ready && employer.messages?.length ? (
                  <ul className="stack" style={{ gap: 6 }}>
                    {employer.messages.map((message) => (
                      <li key={message} style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {message}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {Array.isArray(team.users) && team.users.length ? (
                  <div className="table-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.users.slice(0, 6).map((person) => (
                          <tr key={person.id}>
                            <td>{person.username}</td>
                            <td>
                              <span className={`badge ${person.ready ? 'badge-ok' : ''}`}>{person.ready ? 'Ready' : 'Needs details'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
