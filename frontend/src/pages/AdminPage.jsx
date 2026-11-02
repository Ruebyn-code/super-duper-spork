import { useState } from 'react'
import { get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { money, number } from '../lib/format'
import { Card, CardHead, Empty, ErrorNote, PageHead, Search, Spinner, Stat, Tabs } from '../components/ui'

export default function AdminPage() {
  const { session, can } = useSession()
  const catalogue = useApi(() => get('/api/catalogue'), 'catalogue')
  const locations = useApi(() => get('/api/locations'), 'locations')
  const [term, setTerm] = useState('')
  const [tab, setTab] = useState('stock')

  const data = catalogue.data
  const products = data?.products || []
  const suppliers = data?.suppliers || []
  const filtered = products.filter((product) =>
    !term.trim() ? true : `${product.name} ${product.sku || ''}`.toLowerCase().includes(term.toLowerCase()),
  )
  const priced = products.filter((product) => product.price != null)

  return (
    <div className="stack">
      <PageHead title="Suppliers & stock" description={`${session?.companyName || ''} · catalogue items, pack units and supplier settings.`}>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'stock', label: 'Stock items' },
            { value: 'suppliers', label: 'Suppliers' },
            { value: 'locations', label: 'Locations' },
          ]}
        />
      </PageHead>

      <div className="grid grid-4">
        <Stat label="Catalogue items" value={number(products.length)} />
        <Stat label="Priced items" value={number(priced.length)} note={`${number(products.length - priced.length)} without a price`} />
        <Stat label="Suppliers" value={number(suppliers.length)} />
        <Stat label="Locations" value={number(locations.data?.length || 0)} />
      </div>

      <ErrorNote error={catalogue.error} onRetry={catalogue.reload} />
      {catalogue.loading ? <Spinner label="Loading catalogue" /> : null}

      {tab === 'stock' ? (
        <Card>
          <CardHead title="Stock items" subtitle="Ordered packs and prices" actions={<Search value={term} onChange={setTerm} placeholder="Search stock" />} />
          {!filtered.length && !catalogue.loading ? <Empty title="No stock items" /> : null}
          {filtered.length ? (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Supplier</th>
                    <th>Unit</th>
                    <th className="num">Price</th>
                    <th className="num">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{product.sku || product.id}</div>
                      </td>
                      <td>{suppliers.find((supplier) => supplier.id === product.supplierId)?.name || '—'}</td>
                      <td>{product.unitAmount || '—'}</td>
                      <td className="num">{product.price == null ? 'Pending' : money(product.price)}</td>
                      <td className="num">{product.par?.level != null ? number(product.par.level, 2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === 'suppliers' ? (
        <Card>
          <CardHead title="Suppliers" subtitle="Ordering destinations" />
          {!suppliers.length ? <Empty title="No suppliers yet" /> : null}
          {suppliers.length ? (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Contact</th>
                    <th className="num">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>
                        <strong>{supplier.name}</strong>
                      </td>
                      <td>{supplier.email || supplier.phone || '—'}</td>
                      <td className="num">{number(products.filter((product) => product.supplierId === supplier.id).length)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === 'locations' ? (
        <Card>
          <CardHead title="Locations" subtitle="Company sites and trading status" />
          {locations.data?.length ? (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Company</th>
                    <th className="num">Managers</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.data.map((location) => (
                    <tr key={location.id}>
                      <td>
                        <strong>{location.name}</strong>
                        {location.archived ? <span className="badge" style={{ marginLeft: 8 }}>Archived</span> : null}
                      </td>
                      <td>{location.companyName || '—'}</td>
                      <td className="num">{number(location.managerCount ?? location.managers?.length)}</td>
                      <td>
                        <span className="badge">{location.tradingStatus?.state || 'unknown'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No locations" />
          )}
        </Card>
      ) : null}

      {!can('stock.manage') ? null : (
        <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>
          Item details, pack conversions and ordering rules are edited from the stock item editor in the Opstack console.
        </p>
      )}
    </div>
  )
}
