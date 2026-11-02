import { useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { number, relative } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Notice, PageHead, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'

export default function OpsManagementPage() {
  const { session, can } = useSession()
  const ops = useApi(() => get('/api/ops-management'), 'ops')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const data = ops.data
  const tasks = data?.tasks || []
  const runs = data?.runs || []
  const templates = data?.templates || []
  const planners = data?.planners || []

  async function startRun(plannerId) {
    setBusy(true)
    setError('')
    try {
      await post('/api/ops-management/runs', { plannerId, requestId: crypto.randomUUID() })
      ops.reload()
    } catch (problem) {
      setError(problem.message || 'Could not start this checklist.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageHead title="Checklists" description={`${session?.locationName || ''} · scheduled operational checks for the selected company.`}>
        <Button size="sm" variant="ghost" icon="refresh" onClick={ops.reload}>
          Refresh
        </Button>
      </PageHead>

      {error ? (
        <Notice tone="danger">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </Notice>
      ) : null}

      <div className="grid grid-4">
        <Stat label="Due today" value={number(tasks.length)} note={data?.today || ''} />
        <Stat label="Open runs" value={number(runs.filter((run) => run.status !== 'completed').length)} />
        <Stat label="Templates" value={number(templates.length)} />
        <Stat label="Planners" value={number(planners.length)} />
      </div>

      <Card>
        <CardHead title="Today's checklists" subtitle="Scheduled work for this location" />
        {ops.loading ? <Spinner label="Loading checklists" /> : null}
        <ErrorNote error={ops.error} onRetry={ops.reload} />
        {!ops.loading && !tasks.length ? (
          <Empty title="Nothing scheduled today">Planned checklists appear here when their active window opens.</Empty>
        ) : null}
        {tasks.map((task) => (
          <div className="list-row" key={task.id}>
            <Icon name="clipboard" size={17} />
            <div className="list-main">
              <strong>{task.name || task.title}</strong>
              <small>
                {task.locationName || session?.locationName} · {task.startAt ? relative(task.startAt) : 'scheduled'}
              </small>
            </div>
            {task.status ? <span className={`badge ${task.status === 'completed' ? 'badge-ok' : ''}`}>{task.status}</span> : null}
          </div>
        ))}
      </Card>

      {runs.length ? (
        <Card>
          <CardHead title="Recent runs" subtitle="Saved checklist records" />
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Checklist</th>
                  <th>Started</th>
                  <th>By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 12).map((run) => (
                  <tr key={run.id}>
                    <td>{run.name || run.templateName || 'Checklist'}</td>
                    <td>{relative(run.startedAt)}</td>
                    <td>{run.startedBy?.name || run.username || '—'}</td>
                    <td>
                      <span className={`badge ${run.status === 'completed' ? 'badge-ok' : ''}`}>{run.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {can('ops.manage') ? (
        <div className="grid grid-2">
          <Card>
            <CardHead title="Templates" subtitle="Checklist content" />
            {!templates.length ? <Empty title="No templates yet">Build a checklist to start scheduling work.</Empty> : null}
            {templates.map((template) => (
              <div className="list-row" key={template.id}>
                <div className="list-main">
                  <strong>{template.name}</strong>
                  <small>{number(template.stepCount)} steps</small>
                </div>
                <span className="badge">{template.status || 'draft'}</span>
              </div>
            ))}
          </Card>
          <Card>
            <CardHead title="Plans" subtitle="Recurring schedules" />
            {!planners.length ? <Empty title="No plans yet">Plans schedule a checklist at each location.</Empty> : null}
            {planners.map((planner) => (
              <div className="list-row" key={planner.id}>
                <div className="list-main">
                  <strong>{planner.name || planner.templateName}</strong>
                  <small>{planner.recurrence || planner.schedule || 'Manual'}</small>
                </div>
                <Button size="sm" onClick={() => startRun(planner.id)} disabled={busy}>
                  Start
                </Button>
              </div>
            ))}
          </Card>
        </div>
      ) : null}
    </div>
  )
}
