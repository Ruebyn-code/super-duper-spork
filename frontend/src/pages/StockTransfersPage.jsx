import { useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { money, number, dateLabel } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Field, Modal, Notice, PageHead, Spinner } from '../components/ui'
import Icon from '../components/Icon'

export default function StockTransfersPage() {
  const { session } = useSession()
  const transfers = useApi(() => get('/api/stock-transfers'), 'transfers')
  const options = useApi(() => get('/api/stock-transfers/options'), 'options')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ destinationLocationId: '', moveCosts: false, notes: '' })
  const [quantities, setQuantities] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const destinations = (options.data?.locations || []).filter((location) => location.id !== session?.locationId)
  const products = options.data?.products || []

  async function create(event) {
    event.preventDefault()
    setError('')
    const items = products
      .filter((product) => Number(quantities[product.id]) > 0)
      .map((product) => {
        const quantity = Number(quantities[product.id])
        return { sourceProductId: product.id, targetProductId: product.id, quantity, targetQuantity: quantity }
      })
    if (!form.destinationLocationId || !items.length) {
      setError('Choose a destination and at least one item quantity.')
      return
    }
    setBusy(true)
    try {
      await post('/api/stock-transfers', {
        destinationLocationId: form.destinationLocationId,
        moveCosts: form.moveCosts,
        notes: form.notes,
        items,
        requestId: crypto.randomUUID(),
      })
      setOpen(false)
      setQuantities({})
      setForm({ destinationLocationId: '', moveCosts: false, notes: '' })
      transfers.reload()
    } catch (problem) {
      setError(problem.message || 'Could not send the transfer.')
    } finally {
      setBusy(false)
    }
  }

  async function receive(record) {
    try {
      await post(`/api/stock-transfers/${record.id}/receive`, { revision: record.revision, requestId: crypto.randomUUID() })
      transfers.reload()
    } catch (problem) {
      setError(problem.message || 'Could not receive the transfer.')
    }
  }

  const records = Array.isArray(transfers.data) ? transfers.data : []

  return (
    <div className="stack">
      <PageHead title="Stock transfers" description="Move stock between locations. Transfers are immutable once received and only confirmed transfers change usage.">
        <Button variant="primary" icon="plus" onClick={() => setOpen(true)} disabled={!destinations.length}>
          New transfer
        </Button>
      </PageHead>

      {error ? (
        <Notice tone="danger">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </Notice>
      ) : null}

      <Card>
        <CardHead
          title="Transfers"
          subtitle={`${number(records.length)} records`}
          actions={
            <Button size="sm" variant="ghost" icon="refresh" onClick={transfers.reload}>
              Refresh
            </Button>
          }
        />
        {transfers.loading ? <Spinner label="Loading transfers" /> : null}
        <ErrorNote error={transfers.error} onRetry={transfers.reload} />
        {!transfers.loading && !records.length ? (
          <Empty title="No transfers yet">Send stock to another location to see it here.</Empty>
        ) : null}
        {records.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Sent</th>
                  <th className="num">Items</th>
                  <th className="num">Cost moved</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.from?.name}</td>
                    <td>{record.to?.name}</td>
                    <td>{dateLabel(record.createdAt)}</td>
                    <td className="num">{number(record.items?.length)}</td>
                    <td className="num">{record.moveCosts ? money(record.totalCents) : '—'}</td>
                    <td>
                      <span className={`badge ${record.status === 'received' ? 'badge-ok' : record.status === 'cancelled' ? 'badge-danger' : ''}`}>
                        {record.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {record.status === 'sent' && record.to?.id === session?.locationId ? (
                        <Button size="sm" variant="primary" onClick={() => receive(record)}>
                          Receive
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
          title="Send a stock transfer"
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={create} disabled={busy}>
                {busy ? 'Sending…' : 'Send transfer'}
              </Button>
            </>
          }
        >
          <form className="stack" onSubmit={create}>
            <Field label="Receiving location" htmlFor="transfer-destination">
              <select
                id="transfer-destination"
                className="input"
                value={form.destinationLocationId}
                onChange={(event) => setForm({ ...form, destinationLocationId: event.target.value })}
                required
              >
                <option value="">Choose a location</option>
                {destinations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes" htmlFor="transfer-notes">
              <input
                id="transfer-notes"
                className="input"
                maxLength={1000}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </Field>
            <label className="row" style={{ gap: 8, fontSize: 13.5 }}>
              <input
                type="checkbox"
                checked={form.moveCosts}
                onChange={(event) => setForm({ ...form, moveCosts: event.target.checked })}
              />
              Move stock cost with this transfer
            </label>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
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
                      <td className="num">
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.001"
                          style={{ width: 110, marginLeft: 'auto', textAlign: 'right' }}
                          aria-label={`Transfer quantity for ${product.name}`}
                          value={quantities[product.id] ?? ''}
                          onChange={(event) => setQuantities({ ...quantities, [product.id]: event.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error ? <ErrorNote error={new Error(error)} /> : null}
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
