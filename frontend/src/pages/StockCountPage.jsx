import { useMemo, useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { number, dateLabel } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Field, Modal, Notice, PageHead, Search, Spinner, Tabs } from '../components/ui'
import Icon from '../components/Icon'

const today = () => new Date().toISOString().slice(0, 10)

export default function StockCountPage() {
  const [tab, setTab] = useState('entry')
  const menu = useApi(() => get('/api/menu'), 'menu')
  const history = useApi(() => get('/api/stock-counts'), 'history')
  const [quantities, setQuantities] = useState({})
  const [term, setTerm] = useState('')
  const [form, setForm] = useState({ countDate: today(), notes: '' })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const [viewId, setViewId] = useState(null)
  const detail = useApi(() => (viewId ? get(`/api/stock-counts/${viewId}`) : Promise.resolve(null)), viewId || 'none', {
    enabled: Boolean(viewId),
  })

  const products = Array.isArray(menu.data) ? menu.data : []
  const filtered = products.filter((product) =>
    !term.trim() ? true : `${product.name} ${product.sku || ''} ${product.supplier || ''}`.toLowerCase().includes(term.toLowerCase()),
  )
  const entered = useMemo(() => Object.keys(quantities).filter((id) => quantities[id] !== '' && quantities[id] !== undefined), [quantities])

  async function save(event) {
    event.preventDefault()
    setError('')
    setSaved('')
    const items = products
      .filter((product) => quantities[product.id] !== undefined && quantities[product.id] !== '')
      .map((product) => ({ id: product.id, quantity: Number(quantities[product.id]) }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity >= 0)
    if (!items.length) {
      setError('Enter a quantity for at least one stock item.')
      return
    }
    setBusy(true)
    try {
      const record = await post('/api/stock-counts', {
        countDate: form.countDate,
        notes: form.notes,
        items,
        requestId: crypto.randomUUID(),
      })
      setQuantities({})
      setForm({ countDate: today(), notes: '' })
      setSaved(`Stock count saved · ${number(record.itemCount)} items`)
      history.reload()
      setTab('history')
    } catch (problem) {
      setError(problem.message || 'Could not save the stock count.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageHead title="Stock count" description="Enter the physical quantity for each item. Counts are snapshots and never adjust stock on their own.">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'entry', label: 'New count' },
            { value: 'history', label: 'History' },
          ]}
        />
      </PageHead>

      {saved ? (
        <Notice tone="ok">
          <Icon name="check" size={17} />
          <span>{saved}</span>
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </Notice>
      ) : null}

      {tab === 'entry' ? (
        <form className="stack" onSubmit={save}>
          <Card>
            <div className="card-pad row-wrap" style={{ gap: 16 }}>
              <Field label="Count date" htmlFor="count-date">
                <input
                  id="count-date"
                  className="input"
                  type="date"
                  max={today()}
                  value={form.countDate}
                  onChange={(event) => setForm({ ...form, countDate: event.target.value })}
                  required
                />
              </Field>
              <Field label="Notes" htmlFor="count-notes">
                <input
                  id="count-notes"
                  className="input"
                  style={{ minWidth: 260 }}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Optional note for this count"
                />
              </Field>
              <Search value={term} onChange={setTerm} placeholder="Find an item" />
              <span className="push badge badge-primary">{number(entered.length)} counted</span>
            </div>
          </Card>

          <ErrorNote error={menu.error} onRetry={menu.reload} />
          {menu.loading ? <Spinner label="Loading stock items" /> : null}

          <Card>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Supplier</th>
                    <th className="num">Target</th>
                    <th className="num">Counted</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                          {product.sku || product.id}
                          {product.unitAmount ? ` · ${product.unitAmount}` : ''}
                        </div>
                      </td>
                      <td>{product.supplier || '—'}</td>
                      <td className="num">{product.par?.level != null ? number(product.par.level, 3) : '—'}</td>
                      <td className="num">
                        <input
                          className="input"
                          style={{ width: 110, marginLeft: 'auto', textAlign: 'right' }}
                          type="number"
                          min="0"
                          step="0.001"
                          aria-label={`Counted quantity for ${product.name}`}
                          value={quantities[product.id] ?? ''}
                          onChange={(event) => setQuantities({ ...quantities, [product.id]: event.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save stock count'}
            </Button>
          </div>
        </form>
      ) : (
        <Card>
          <CardHead
            title="Saved counts"
            subtitle="Immutable snapshots for this location"
            actions={
              <Button size="sm" variant="ghost" icon="refresh" onClick={history.reload}>
                Refresh
              </Button>
            }
          />
          {history.loading ? <Spinner label="Loading counts" /> : null}
          <ErrorNote error={history.error} onRetry={history.reload} />
          {history.data && !history.data.length && !history.loading ? (
            <Empty title="No counts saved yet">Save your first count from the New count tab.</Empty>
          ) : null}
          {Array.isArray(history.data) && history.data.length ? (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Counted by</th>
                    <th className="num">Items</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{dateLabel(record.countDate)}</strong>
                      </td>
                      <td>{record.counterName || '—'}</td>
                      <td className="num">{number(record.itemCount)}</td>
                      <td style={{ color: 'var(--muted)' }}>{record.notes || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Button size="sm" onClick={() => setViewId(record.id)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      )}

      {viewId ? (
        <Modal title="Stock count" onClose={() => setViewId(null)} wide>
          {detail.loading ? <Spinner /> : <ErrorNote error={detail.error} />}
          {detail.data ? (
            <div className="stack">
              <div className="row-wrap">
                <span className="badge badge-primary">{dateLabel(detail.data.countDate)}</span>
                <span className="badge">{detail.data.counterName}</span>
                <span className="badge">{number(detail.data.itemCount)} items</span>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Supplier</th>
                      <th className="num">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.data.items || []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.supplier || '—'}</td>
                        <td className="num">{number(item.quantity, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.data.notes ? <p style={{ color: 'var(--text-soft)', fontSize: 13.5 }}>{detail.data.notes}</p> : null}
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}
