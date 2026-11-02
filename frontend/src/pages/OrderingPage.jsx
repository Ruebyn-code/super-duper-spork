import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useCart } from '../context/CartContext'
import { useSession } from '../context/SessionContext'
import { money, number } from '../lib/format'
import { Card, CardHead, Empty, ErrorNote, PageHead, Search, Spinner, Button, Tabs } from '../components/ui'
import Icon from '../components/Icon'

export default function OrderingPage() {
  const menu = useApi(() => get('/api/menu'), 'menu')
  const { items, add, setQuantity } = useCart()
  const { can } = useSession()
  const [term, setTerm] = useState('')
  const [supplier, setSupplier] = useState('all')

  const products = Array.isArray(menu.data) ? menu.data : []
  const suppliers = useMemo(() => {
    const map = new Map()
    for (const product of products) map.set(product.supplierId, product.supplier || product.supplierId)
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [products])

  const filtered = products.filter((product) => {
    if (supplier !== 'all' && product.supplierId !== supplier) return false
    if (!term.trim()) return true
    const haystack = `${product.name} ${product.sku || ''} ${product.category || ''} ${product.description || ''}`.toLowerCase()
    return haystack.includes(term.trim().toLowerCase())
  })

  const cartLines = products.filter((product) => items[product.id])
  const cartTotal = cartLines.reduce((sum, product) => sum + (product.price || 0) * items[product.id], 0)
  const cartUnits = cartLines.reduce((sum, product) => sum + items[product.id], 0)

  return (
    <div className="stack">
      <PageHead
        title="Ordering"
        description="Browse the supplier catalogue, check stock and add items to the cart. Targets come from saved stock counts and usage."
      >
        <Link className="btn btn-primary" to="/cart">
          <Icon name="cart" size={16} />
          Cart {cartUnits ? `· ${cartUnits}` : ''}
        </Link>
      </PageHead>

      <Card>
        <div className="card-pad row-wrap" style={{ gap: 14 }}>
          <Search value={term} onChange={setTerm} placeholder="Search stock" />
          <div className="tabs">
            <Tabs
              value={supplier}
              onChange={setSupplier}
              options={[{ value: 'all', label: 'All suppliers' }, ...suppliers.map((entry) => ({ value: entry.id, label: entry.name }))]}
            />
          </div>
          <span className="push" style={{ color: 'var(--muted)', fontSize: 13 }}>
            {number(filtered.length)} items
          </span>
        </div>
      </Card>

      <ErrorNote error={menu.error} onRetry={menu.reload} />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px', alignItems: 'start' }}>
        <div>
          {menu.loading ? <Spinner label="Loading catalogue" /> : null}
          {!menu.loading && !filtered.length ? (
            <Card>
              <Empty title="No items match">Try another supplier or search term.</Empty>
            </Card>
          ) : null}
          <div className="product-grid">
            {filtered.map((product) => {
              const quantity = items[product.id] || 0
              const recommended = Number.isFinite(product.ordering?.recommended) ? product.ordering.recommended : null
              const target = product.par?.level != null ? Number(product.par.level) : null
              return (
                <article className="product" key={product.id}>
                  <div className="product-art">{product.emoji || '📦'}</div>
                  <div className="product-name">{product.name}</div>
                  {product.unitAmount ? <div className="product-unit">{product.unitAmount}</div> : null}
                  <div className="product-meta">
                    {product.sku ? `${product.sku} · ` : ''}
                    {product.supplier}
                  </div>
                  {recommended != null ? (
                    <span className="badge badge-primary">Order {number(recommended, 2)}</span>
                  ) : target != null ? (
                    <span className="badge">Target {number(target, 2)}</span>
                  ) : null}
                  <div className="product-foot">
                    <span className="price">{product.price == null ? 'Price pending' : money(product.price)}</span>
                    {can('orders.place') ? (
                      quantity ? (
                        <span className="qty">
                          <button type="button" aria-label={`Reduce ${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
                            −
                          </button>
                          <span>{quantity}</span>
                          <button type="button" aria-label={`Add another ${product.name}`} onClick={() => add(product.id)}>
                            +
                          </button>
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => add(product.id, recommended != null && recommended >= 1 ? Math.round(recommended) : 1)}>
                          Add
                        </Button>
                      )
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <Card style={{ position: 'sticky', top: 78 }}>
          <CardHead title="Cart" subtitle={`${number(cartUnits)} units`} />
          <div className="card-pad" style={{ paddingTop: 4 }}>
            {!cartLines.length ? (
              <Empty title="Cart is empty">Add stock from the catalogue to build an order.</Empty>
            ) : (
              <>
                {cartLines.map((product) => (
                  <div className="cart-line" key={product.id}>
                    <div className="list-main">
                      <strong>{product.name}</strong>
                      <small>{money((product.price || 0) * items[product.id])}</small>
                    </div>
                    <span className="qty">
                      <button type="button" aria-label={`Reduce ${product.name}`} onClick={() => setQuantity(product.id, items[product.id] - 1)}>
                        −
                      </button>
                      <span>{items[product.id]}</span>
                      <button type="button" aria-label={`Add ${product.name}`} onClick={() => add(product.id)}>
                        +
                      </button>
                    </span>
                  </div>
                ))}
                <div className="total-row grand">
                  <span>Estimated</span>
                  <span>{money(cartTotal)}</span>
                </div>
                <Link className="btn btn-primary" to="/cart" style={{ width: '100%', marginTop: 12 }}>
                  Review order
                </Link>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
