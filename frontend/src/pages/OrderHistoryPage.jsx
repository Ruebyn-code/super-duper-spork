import { useState } from 'react'
import { get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { money, number, dateLabel, relative } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Modal, PageHead, Search, Spinner } from '../components/ui'
import Icon from '../components/Icon'

export default function OrderHistoryPage() {
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const history = useApi(() => get(`/api/order-history?page=${page}`), `history-${page}`)
  const detail = useApi(() => (openId ? get(`/api/order-history/${openId}`) : Promise.resolve(null)), openId || 'none', {
    enabled: Boolean(openId),
  })

  const orders = (history.data?.orders || []).filter((order) => {
    if (!term.trim()) return true
    const haystack = `${order.orderNumber || ''} ${order.name || ''} ${order.supplier || ''}`.toLowerCase()
    return haystack.includes(term.trim().toLowerCase())
  })

  return (
    <div className="stack">
      <PageHead title="Order history" description="Saved orders for the selected location. Open an order to see items, prices and delivery status.">
        <Search value={term} onChange={setTerm} placeholder="Search orders" />
      </PageHead>

      <ErrorNote error={history.error} onRetry={history.reload} />

      <Card>
        <CardHead
          title="Orders"
          subtitle={history.data ? `${number(history.data.total)} orders` : undefined}
          actions={
            <Button size="sm" variant="ghost" icon="refresh" onClick={history.reload}>
              Refresh
            </Button>
          }
        />
        {history.loading ? <Spinner label="Loading orders" /> : null}
        {!history.loading && history.data && !orders.length ? (
          <Empty title="No orders yet">Orders placed from the ordering page appear here.</Empty>
        ) : null}
        {orders.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Requester</th>
                  <th className="num">Items</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber || order.id.slice(0, 8)}</strong>
                    </td>
                    <td>{relative(order.createdAt)}</td>
                    <td>{order.name || '—'}</td>
                    <td className="num">{number(order.items?.length)}</td>
                    <td className="num">{money(order.total)}</td>
                    <td>
                      <span className="badge">{order.status || 'requested'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button size="sm" onClick={() => setOpenId(order.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {history.data && history.data.pages > 1 ? (
          <div className="card-pad row" style={{ justifyContent: 'space-between' }}>
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              Page {history.data.page} of {history.data.pages}
            </span>
            <Button size="sm" disabled={page >= history.data.pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </Card>

      {openId ? (
        <Modal title="Order details" onClose={() => setOpenId(null)} wide>
          {detail.loading ? <Spinner /> : <ErrorNote error={detail.error} />}
          {detail.data ? (
            <div className="stack">
              <div className="row-wrap">
                <span className="badge badge-primary">{detail.data.orderNumber || detail.data.id.slice(0, 8)}</span>
                <span className="badge">{dateLabel(detail.data.createdAt)}</span>
                <span className="badge">{money(detail.data.total)}</span>
                {detail.data.pricePending ? <span className="badge badge-warn">Prices pending</span> : null}
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Supplier</th>
                      <th className="num">Qty</th>
                      <th className="num">Price</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.data.items || []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.supplier || '—'}</td>
                        <td className="num">{number(item.quantity, 3)}</td>
                        <td className="num">{money(item.price)}</td>
                        <td className="num">{money((item.price || 0) * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.data.notes ? (
                <div>
                  <div className="stat-label">Notes</div>
                  <p style={{ fontSize: 13.5, color: 'var(--text-soft)' }}>{detail.data.notes}</p>
                </div>
              ) : null}
              {Array.isArray(detail.data.delivery) && detail.data.delivery.length ? (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="stat-label">Supplier delivery</div>
                  {detail.data.delivery.map((entry) => (
                    <div className="row" key={entry.supplierId}>
                      <Icon name="truck" size={16} />
                      <strong style={{ fontSize: 13.5 }}>{entry.supplier}</strong>
                      <span className="badge">{entry.status.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}
