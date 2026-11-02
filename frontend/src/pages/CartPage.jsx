import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useCart } from '../context/CartContext'
import { useSession } from '../context/SessionContext'
import { money, number } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Field, Notice, PageHead, Spinner } from '../components/ui'
import Icon from '../components/Icon'

export default function CartPage() {
  const menu = useApi(() => get('/api/menu'), 'menu')
  const { items, setQuantity, remove, clear } = useCart()
  const { session, can } = useSession()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: session?.username || '', phone: '', notes: '' })
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const products = Array.isArray(menu.data) ? menu.data : []
  const lines = useMemo(
    () => products.filter((product) => items[product.id]).map((product) => ({ ...product, quantity: items[product.id] })),
    [products, items],
  )
  const total = lines.reduce((sum, line) => sum + (line.price || 0) * line.quantity, 0)
  const pricePending = lines.some((line) => line.price == null)

  async function placeOrder(event) {
    event.preventDefault()
    if (!lines.length) return
    setBusy(true)
    setError('')
    try {
      const order = await post('/api/orders', {
        items: lines.map((line) => ({ id: line.id, quantity: line.quantity })),
        name: form.name,
        phone: form.phone,
        notes: form.notes,
        requestId: crypto.randomUUID(),
      })
      setResult(order)
      clear()
    } catch (problem) {
      setError(problem.message || 'Could not place the order.')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="stack">
        <PageHead title="Order placed" description="Your suppliers and confirmation have been processed where sending is configured.">
          <Button onClick={() => navigate('/order-history')} icon="list">Order history</Button>
          <Link className="btn btn-primary" to="/">Order more</Link>
        </PageHead>
        <Card>
          <div className="card-pad stack">
            <Notice tone="ok">
              <Icon name="check" size={17} />
              <span>
                Order {result.orderNumber || result.id} saved · {money(result.total)}
                {result.pricePending ? ' · some prices pending' : ''}
              </span>
            </Notice>
            {Array.isArray(result.delivery) && result.delivery.length ? (
              <div className="stack" style={{ gap: 8 }}>
                {result.delivery.map((entry) => (
                  <div className="row" key={entry.supplierId}>
                    <span className="badge">{entry.supplier}</span>
                    <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{entry.status.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="stack">
      <PageHead title="Cart" description={`${session?.locationName || ''} · review quantities before placing the order.`}>
        <Link className="btn" to="/">Keep ordering</Link>
      </PageHead>

      {menu.loading ? <Spinner label="Loading cart" /> : null}
      <ErrorNote error={menu.error} onRetry={menu.reload} />

      {!menu.loading && !lines.length ? (
        <Card>
          <Empty title="Your cart is empty" action={<Link className="btn btn-primary" to="/">Browse ordering</Link>}>
            Add stock from the catalogue and it will appear here.
          </Empty>
        </Card>
      ) : null}

      {lines.length ? (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 380px', alignItems: 'start' }}>
          <Card>
            <CardHead title="Items" subtitle={`${number(lines.length)} products`} />
            <div className="card-pad" style={{ paddingTop: 4 }}>
              {lines.map((line) => (
                <div className="cart-line" key={line.id}>
                  <div className="list-main">
                    <strong>{line.name}</strong>
                    <small>
                      {line.supplier} · {line.price == null ? 'price pending' : money(line.price)} each
                    </small>
                  </div>
                  <span className="qty">
                    <button type="button" aria-label={`Reduce ${line.name}`} onClick={() => setQuantity(line.id, line.quantity - 1)}>
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      aria-label={`Quantity for ${line.name}`}
                      value={line.quantity}
                      onChange={(event) => setQuantity(line.id, Number(event.target.value))}
                    />
                    <button type="button" aria-label={`Add ${line.name}`} onClick={() => setQuantity(line.id, line.quantity + 1)}>
                      +
                    </button>
                  </span>
                  <strong style={{ minWidth: 80, textAlign: 'right' }}>{money((line.price || 0) * line.quantity)}</strong>
                  <button type="button" className="icon-btn" aria-label={`Remove ${line.name}`} onClick={() => remove(line.id)}>
                    <Icon name="x" size={15} />
                  </button>
                </div>
              ))}
              <div className="total-row grand">
                <span>Estimated total</span>
                <span>{money(total)}</span>
              </div>
              {pricePending ? <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Some items have no saved price yet.</p> : null}
            </div>
          </Card>

          <Card>
            <CardHead title="Place order" subtitle={session?.locationName} />
            <form className="card-pad stack" onSubmit={placeOrder}>
              {error ? (
                <Notice tone="danger">
                  <Icon name="alert" size={17} />
                  <span>{error}</span>
                </Notice>
              ) : null}
              <Field label="Your name" htmlFor="order-name">
                <input id="order-name" className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </Field>
              <Field label="Contact number" hint="Optional, shown to the supplier." htmlFor="order-phone">
                <input id="order-phone" className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </Field>
              <Field label="Notes for suppliers" htmlFor="order-notes">
                <textarea id="order-notes" className="input" maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </Field>
              <Button type="submit" variant="primary" disabled={busy || !can('orders.place')} style={{ minHeight: 44 }}>
                {busy ? 'Placing order…' : `Place order · ${money(total)}`}
              </Button>
              <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                Totals are estimates. Supplier messages are only sent where this location has sending configured.
              </p>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
