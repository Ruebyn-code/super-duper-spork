import { useState } from 'react'
import { get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { number, dateLabel, relative } from '../lib/format'
import { Card, CardHead, Empty, ErrorNote, PageHead, Search, Spinner, Stat } from '../components/ui'

export default function EmploymentDocumentsPage() {
  const { session } = useSession()
  const documents = useApi(() => get('/api/employment-documents'), 'documents')
  const [term, setTerm] = useState('')
  const data = documents.data
  const list = (data?.documents || []).filter((document) =>
    !term.trim() ? true : `${document.title || ''} ${document.personName || document.username || ''}`.toLowerCase().includes(term.toLowerCase()),
  )

  const signed = list.filter((document) => document.status === 'signed' || document.signedAt).length

  return (
    <div className="stack">
      <PageHead title="Employment documents" description={`${session?.locationName || ''} · issued contracts, agreements and acknowledgements.`} />

      <div className="grid grid-4">
        <Stat label="Documents" value={number(list.length)} />
        <Stat label="Signed" value={number(signed)} tone="ok" />
        <Stat label="Awaiting signature" value={number(list.length - signed)} />
        <Stat label="Templates" value={number(data?.options?.templates?.length || 0)} />
      </div>

      <Card>
        <CardHead title="Documents" subtitle="Immutable once issued" actions={<Search value={term} onChange={setTerm} placeholder="Search documents" />} />
        {documents.loading ? <Spinner label="Loading documents" /> : null}
        <ErrorNote error={documents.error} onRetry={documents.reload} />
        {!documents.loading && !list.length ? (
          <Empty title="No documents issued">Issue agreements from an employee’s Pay Conditions to see them here.</Empty>
        ) : null}
        {list.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Person</th>
                  <th>Issued</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <strong>{document.title || document.templateName || 'Employment document'}</strong>
                    </td>
                    <td>{document.personName || document.username || '—'}</td>
                    <td>{document.issuedAt ? dateLabel(document.issuedAt) : '—'}</td>
                    <td>
                      <span className={`badge ${document.signedAt ? 'badge-ok' : 'badge-warn'}`}>
                        {document.signedAt ? `Signed ${relative(document.signedAt)}` : 'Awaiting signature'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {data?.options?.people?.length ? (
        <Card>
          <CardHead title="People you can issue to" subtitle="Scoped by your location access" />
          <div className="card-pad">
            <div className="row-wrap">
              {data.options.people.map((person) => (
                <span className="badge" key={person.id}>
                  {person.username}
                </span>
              ))}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
