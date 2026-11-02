import { useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { number, relative } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Field, Modal, Notice, PageHead, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'

export default function KioskDevicesPage() {
  const { session } = useSession()
  const devices = useApi(() => get('/api/kiosk-devices'), 'devices')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', locationId: session?.locationId || '' })
  const [pairing, setPairing] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const data = devices.data
  const list = data?.devices || []
  const locations = data?.locations || []

  async function create(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await post('/api/kiosk-devices', {
        name: draft.name,
        locationId: draft.locationId,
        features: ['app'],
        requestId: crypto.randomUUID(),
      })
      setPairing(result)
      setOpen(false)
      setDraft({ name: '', locationId: session?.locationId || '' })
      devices.reload()
    } catch (problem) {
      setError(problem.message || 'Could not create the kiosk device.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageHead title="Kiosk devices" description="Paired shop-floor devices, their location and latest activity.">
        <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
          Pair a device
        </Button>
      </PageHead>

      {pairing ? (
        <Notice tone="ok">
          <Icon name="check" size={17} />
          <span>
            {pairing.code ? `Pairing code ${pairing.code} — enter it on the kiosk.` : 'Device created. Follow the pairing steps on the kiosk.'}
          </span>
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </Notice>
      ) : null}

      <div className="grid grid-4">
        <Stat label="Devices" value={number(list.length)} />
        <Stat label="Locations" value={number(locations.length)} />
        <Stat label="Features" value={number(data?.features?.length)} />
        <Stat label="Network" value={data?.network || '—'} />
      </div>

      <ErrorNote error={devices.error} onRetry={devices.reload} />
      {devices.loading ? <Spinner label="Loading devices" /> : null}

      <Card>
        <CardHead title="Paired devices" subtitle="Device credentials are stored as hashes" />
        {!devices.loading && !list.length ? <Empty title="No kiosks yet">Pair a device to let staff sign in with a PIN.</Empty> : null}
        {list.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Location</th>
                  <th>Paired</th>
                  <th>Last seen</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <strong>{device.name}</strong>
                    </td>
                    <td>{device.locationName || locations.find((location) => location.id === device.locationId)?.name || '—'}</td>
                    <td>{device.createdAt ? relative(device.createdAt) : '—'}</td>
                    <td>{device.lastSeenAt ? relative(device.lastSeenAt) : 'Never'}</td>
                    <td>
                      <span className={`badge ${device.status === 'active' ? 'badge-ok' : ''}`}>{device.status || 'paired'}</span>
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
          title="Pair a kiosk"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={create} disabled={busy}>
                {busy ? 'Creating…' : 'Create pairing'}
              </Button>
            </>
          }
        >
          <form className="stack" onSubmit={create}>
            <Field label="Device name" htmlFor="kiosk-name" hint="For example: Front counter iPad.">
              <input id="kiosk-name" className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
            </Field>
            <Field label="Location" htmlFor="kiosk-location">
              <select id="kiosk-location" className="input" value={draft.locationId} onChange={(event) => setDraft({ ...draft, locationId: event.target.value })}>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
            <Notice tone="info">
              <Icon name="shield" size={17} />
              <span>Pairing never grants permissions. Staff sign in with their own PIN and keep their own access.</span>
            </Notice>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
