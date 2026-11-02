import { useState } from 'react'
import { get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { number, dateLabel } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, PageHead, Search, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'

export default function LabelsPage() {
  const { session } = useSession()
  const labels = useApi(() => get('/api/prep-labels'), 'labels')
  const [term, setTerm] = useState('')
  const data = labels.data
  const items = (data?.items || []).filter((item) =>
    !term.trim() ? true : `${item.name || ''} ${item.category || ''}`.toLowerCase().includes(term.toLowerCase()),
  )
  const batches = data?.batches || []

  return (
    <div className="stack">
      <PageHead title="Labels" description={`${session?.locationName || ''} · prep labels, shelf life and print history.`}>
        <Button size="sm" variant="ghost" icon="refresh" onClick={labels.reload}>
          Refresh
        </Button>
      </PageHead>

      <div className="grid grid-4">
        <Stat label="Label items" value={number(items.length)} />
        <Stat label="Batches printed" value={number(batches.length)} />
        <Stat label="Media" value={data?.settings ? `${data.settings.widthMm} × ${data.settings.heightMm} mm` : '—'} />
        <Stat label="Resolution" value={data?.settings ? `${data.settings.dpi} dpi` : '—'} />
      </div>

      <ErrorNote error={labels.error} onRetry={labels.reload} />
      {labels.loading ? <Spinner label="Loading labels" /> : null}

      <Card>
        <CardHead
          title="Label templates"
          subtitle="Templates belong to the selected company"
          actions={<Search value={term} onChange={setTerm} placeholder="Search labels" />}
        />
        {!labels.loading && !items.length ? (
          <Empty title="No label templates yet">Create label templates in the label designer to print prep labels.</Empty>
        ) : null}
        {items.length ? (
          <div className="grid grid-3 card-pad">
            {items.map((item) => (
              <div className="card card-pad" key={item.id} style={{ boxShadow: 'none' }}>
                <div className="row">
                  <Icon name="printer" size={18} />
                  <strong style={{ fontSize: 14 }}>{item.name}</strong>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 6 }}>
                  {item.category || 'Uncategorised'}
                  {item.shelfLifeHours ? ` · ${number(item.shelfLifeHours)} h shelf life` : ''}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHead title="Recent batches" subtitle="Saved label batches" />
        {!batches.length ? <Empty title="No batches yet">Printed batches are saved with their immutable label snapshots.</Empty> : null}
        {batches.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Printed</th>
                  <th>Template</th>
                  <th className="num">Labels</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {batches.slice(0, 20).map((batch) => (
                  <tr key={batch.id}>
                    <td>{dateLabel(batch.createdAt)}</td>
                    <td>{batch.templateName || batch.name || '—'}</td>
                    <td className="num">{number(batch.quantity || batch.labels?.length)}</td>
                    <td>{batch.createdBy?.name || batch.username || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
