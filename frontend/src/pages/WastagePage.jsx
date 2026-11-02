import { useMemo, useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { money, number, dateLabel } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Field, Modal, Notice, PageHead, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => `${today().slice(0, 7)}-01`

export default function WastagePage() {
  const [range, setRange] = useState({ from: firstOfMonth(), to: today() })
  const list = useApi(() => get(`/api/wastage?from=${range.from}&to=${range.to}`), `${range.from}:${range.to}`)
  const options = useApi(() => get('/api/wastage/options'), 'options')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ wasteDate: today(), notes: '' })
  const [lines, setLines] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')

  const records = list.data?.records || []
  const summary = list.data?.summary
  const products = options.data?.products || []
  const reasons = options.data?.reasons || []

  const totals = useMemo(
    () => ({
      records: records.length,
      known: summary?.knownCostCents || 0,
      unpriced: summary?.unpricedItems || 0,
    }),
    [records, summary],
  )

  async function save(event) {
    event.preventDefault()
    setError('')
    const items = products
      .filter((product) => lines[product.id]?.quantity > 0)
      .map((product) => ({
        id: product.id,
        unitAmount: product.unitAmount || '',
        quantity: Number(lines[product.id].quantity),
        reason: lines[product.id].reason || 'other',
      }))
    if (!items.length) {
      setError('Enter a quantity and reason for at least one item.')
      return
    }
    setBusy(true)
    try {
      await post('/api/wastage', {
        wasteDate: form.wasteDate,
        notes: form.notes,
        items,
        requestId: crypto.randomUUID(),
      })
      setOpen(false)
      setLines({})
      setForm({ wasteDate: today(), notes: '' })
      list.reload()
    } catch (problem) {
      setError(problem.message || 'Could not save the wastage entry.')
    } finally {
      setBusy(false)
    }
  }

  async function voidEntry() {
    if (!voidTarget) return
    try {
      await post(`/api/wastage/${voidTarget.id}/void`, {
        revision: voidTarget.revision,
        reason: voidReason,
        requestId: crypto.randomUUID(),
      })
      setVoidTarget(null)
      setVoidReason('')
      list.reload()
    } catch (problem) {
      setError(problem.message || 'Could not void this entry.')
    }
  }

  return (
    <div className="stack">
      <PageHead title="Wastage" description="A stock log for the selected location. Wastage never subtracts stock twice or places orders.">
        <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
          Record wastage
        </Button>
      </PageHead>

      <Card>
        <div className="card-pad row-wrap" style={{ gap: 16 }}>
          <Field label="From" htmlFor="waste-from">
            <input id="waste-from" className="input" type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} />
          </Field>
          <Field label="To" htmlFor="waste-to">
            <input id="waste-to" className="input" type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} />
          </Field>
          <Button size="sm" variant="ghost" icon="refresh" onClick={list.reload} className="push">
            Refresh
          </Button>
        </div>
      </Card>

      <div className="grid grid-3">
        <Stat label="Entries" value={number(totals.records)} />
        <Stat label="Known cost" value={money(totals.known)} note="From saved stock prices" />
        <Stat label="Unpriced items" value={number(totals.unpriced)} note="Cost unavailable for these" />
      </div>

      {error ? (
        <Notice tone="danger">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </Notice>
      ) : null}

      <Card>
        <CardHead title="Wastage entries" subtitle={`${range.from} → ${range.to}`} />
        {list.loading ? <Spinner label="Loading wastage" /> : null}
        <ErrorNote error={list.error} onRetry={list.reload} />
        {!list.loading && !records.length ? <Empty title="No wastage recorded">Record waste as it happens to keep costs visible.</Empty> : null}
        {records.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Items</th>
                  <th className="num">Cost</th>
                  <th>Recorded by</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{dateLabel(record.wasteDate)}</strong>
                    </td>
                    <td>{record.items?.map((item) => `${item.name} × ${number(item.quantity, 3)}`).join(', ')}</td>
                    <td className="num">{record.totalCents == null ? '—' : money(record.totalCents)}</td>
                    <td>{record.createdBy?.name || '—'}</td>
                    <td>
                      <span className={`badge ${record.status === 'voided' ? 'badge-danger' : 'badge-ok'}`}>{record.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {record.status === 'recorded' ? (
                        <Button size="sm" variant="ghost" onClick={() => setVoidTarget(record)}>
                          Void
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {open ? (
        <Modal
          title="Record wastage"
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save wastage'}
              </Button>
            </>
          }
        >
          <div className="stack">
            <div className="grid grid-2">
              <Field label="Wastage date" htmlFor="waste-date">
                <input
                  id="waste-date"
                  className="input"
                  type="date"
                  max={today()}
                  value={form.wasteDate}
                  onChange={(event) => setForm({ ...form, wasteDate: event.target.value })}
                />
              </Field>
              <Field label="Notes" htmlFor="waste-notes">
                <input id="waste-notes" className="input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </Field>
            </div>
            {error ? <ErrorNote error={new Error(error)} /> : null}
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Reason</th>
                    <th className="num">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{product.unitAmount || product.sku}</div>
                      </td>
                      <td>
                        <select
                          className="input"
                          aria-label={`Reason for ${product.name}`}
                          value={lines[product.id]?.reason || 'expired'}
                          onChange={(event) =>
                            setLines({ ...lines, [product.id]: { ...lines[product.id], reason: event.target.value } })
                          }
                        >
                          {reasons.map((reason) => (
                            <option key={reason.id} value={reason.id}>
                              {reason.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="num">
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.001"
                          style={{ width: 110, marginLeft: 'auto', textAlign: 'right' }}
                          aria-label={`Wasted quantity for ${product.name}`}
                          value={lines[product.id]?.quantity ?? ''}
                          onChange={(event) =>
                            setLines({ ...lines, [product.id]: { ...lines[product.id], quantity: event.target.value } })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      ) : null}

      {voidTarget ? (
        <Modal
          title="Void wastage entry"
          onClose={() => setVoidTarget(null)}
          footer={
            <>
              <Button onClick={() => setVoidTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={voidEntry} disabled={!voidReason.trim()}>
                Void entry
              </Button>
            </>
          }
        >
          <div className="stack">
            <Notice tone="info">
              <Icon name="alert" size={17} />
              <span>Voiding keeps the original record and audit; it never deletes history.</span>
            </Notice>
            <Field label="Why is this entry void?" htmlFor="void-reason">
              <textarea
                id="void-reason"
                className="input"
                maxLength={500}
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
