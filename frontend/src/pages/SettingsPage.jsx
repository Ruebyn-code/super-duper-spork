import { useEffect, useState } from 'react'
import { api, get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { Button, Card, CardHead, ErrorNote, Field, Notice, PageHead, Spinner, Tabs } from '../components/ui'
import Icon from '../components/Icon'

export default function SettingsPage() {
  const { session, appearance, refresh } = useSession()
  const text = useApi(() => get('/api/interface-text'), 'text')
  const [tab, setTab] = useState('colours')
  const [colours, setColours] = useState({ primary: '#008CFF', secondary: '#45EFC3' })
  const [full, setFull] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    get('/appearance')
      .then((data) => {
        if (cancelled) return
        setFull(data)
        setColours({ primary: data.primary || '#008CFF', secondary: data.secondary || '#45EFC3' })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [appearance])

  async function saveColours() {
    setBusy(true)
    setError('')
    setSaved('')
    try {
      // Full appearance writes keep fonts, backgrounds and wording untouched.
      await api('/api/settings', { method: 'PUT', body: { ...(full || {}), ...colours } })
      document.documentElement.style.setProperty('--primary', colours.primary)
      document.documentElement.style.setProperty('--secondary', colours.secondary)
      setSaved('Company colours saved.')
      refresh()
    } catch (problem) {
      setError(problem.message || 'Could not save the appearance.')
    } finally {
      setBusy(false)
    }
  }

  const overrides = Object.keys(text.data?.overrides || {}).length

  return (
    <div className="stack">
      <PageHead title="App settings" description={`${session?.companyName || ''} · company colours and interface wording.`}>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'colours', label: 'Colours' },
            { value: 'wording', label: 'Wording' },
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

      {tab === 'colours' ? (
        <div className="grid grid-2">
          <Card>
            <CardHead title="Company colours" subtitle="Applied across every rebuilt screen" />
            <div className="card-pad stack">
              <Field label="Primary colour" htmlFor="primary-colour">
                <div className="row">
                  <input
                    id="primary-colour"
                    type="color"
                    value={colours.primary}
                    onChange={(event) => setColours({ ...colours, primary: event.target.value })}
                    style={{ width: 56, height: 42, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}
                  />
                  <input className="input" value={colours.primary} onChange={(event) => setColours({ ...colours, primary: event.target.value })} />
                </div>
              </Field>
              <Field label="Secondary colour" htmlFor="secondary-colour">
                <div className="row">
                  <input
                    id="secondary-colour"
                    type="color"
                    value={colours.secondary}
                    onChange={(event) => setColours({ ...colours, secondary: event.target.value })}
                    style={{ width: 56, height: 42, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}
                  />
                  <input className="input" value={colours.secondary} onChange={(event) => setColours({ ...colours, secondary: event.target.value })} />
                </div>
              </Field>
              <Button variant="primary" onClick={saveColours} disabled={busy}>
                {busy ? 'Saving…' : 'Save colours'}
              </Button>
            </div>
          </Card>
          <Card>
            <CardHead title="Preview" subtitle="How the palette reads on this screen" />
            <div className="card-pad stack">
              <div className="row">
                <span className="btn btn-primary">Primary action</span>
                <span className="btn">Secondary action</span>
              </div>
              <div className="row">
                <span className="badge badge-primary">Badge</span>
                <span className="badge">Neutral</span>
              </div>
              <div className="progress">
                <div style={{ width: '62%', background: colours.primary }} />
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                Secondary is used for accents and detail, not body text, so light company colours stay readable.
              </p>
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHead title="Interface wording" subtitle={`${overrides} saved overrides`} />
          {text.loading ? <Spinner /> : <ErrorNote error={text.error} onRetry={text.reload} />}
          <div className="card-pad stack">
            <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
              Company wording overrides are read by every page. Editing them remains in the Opstack appearance console, which
              validates placeholders before saving.
            </p>
            {overrides ? (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Custom wording</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(text.data?.overrides || {})
                      .slice(0, 30)
                      .map(([key, value]) => (
                        <tr key={key}>
                          <td>
                            <code style={{ fontSize: 12 }}>{key}</code>
                          </td>
                          <td>{String(value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  )
}
