import { useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { Button, Card, CardHead, ErrorNote, Field, Notice, PageHead, Spinner } from '../components/ui'
import Icon from '../components/Icon'

export default function KioskPage() {
  const status = useApi(() => get('/api/kiosk/status'), 'kiosk')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const data = status.data

  async function unlock(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await post('/api/kiosk/unlock', { pin })
      window.location.assign('/home')
    } catch (problem) {
      setError(problem.message || 'That PIN was not accepted.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageHead title="Kiosk" description="Shared device sign-in for the shop floor." />

      {status.loading ? <Spinner label="Checking this device" /> : null}
      <ErrorNote error={status.error} onRetry={status.reload} />

      {data && !data.paired ? (
        <Card>
          <CardHead title="This device is not paired" subtitle="Pairing is managed by Head Office" />
          <div className="card-pad stack">
            <Notice tone="info">
              <Icon name="phone" size={17} />
              <span>
                Open Settings → Kiosk devices on a manager account to pair this browser to a location. Pairing keeps the device
                bound to that location and never adds permissions.
              </span>
            </Notice>
            <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
              Once paired, staff enter their four-digit clock PIN to open the app with their own permissions.
            </p>
          </div>
        </Card>
      ) : null}

      {data?.paired ? (
        <Card style={{ maxWidth: 460 }}>
          <CardHead title="Enter your PIN" subtitle={data.locationName || 'Paired kiosk'} />
          <form className="card-pad stack" onSubmit={unlock}>
            {error ? <ErrorNotice error={error} /> : null}
            <Field label="Four-digit PIN" htmlFor="kiosk-pin" hint="Your PIN is the last four digits of your phone number.">
              <input
                id="kiosk-pin"
                className="input"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                style={{ fontSize: 26, letterSpacing: 12, textAlign: 'center' }}
              />
            </Field>
            <Button type="submit" variant="primary" disabled={busy || pin.length !== 4}>
              {busy ? 'Unlocking…' : 'Unlock'}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  )
}

function ErrorNotice({ error }) {
  return (
    <Notice tone="danger">
      <Icon name="alert" size={17} />
      <span>{error}</span>
    </Notice>
  )
}
