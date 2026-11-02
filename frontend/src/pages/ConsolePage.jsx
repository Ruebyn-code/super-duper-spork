import { useEffect, useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { money, number } from '../lib/format'
import { Button, Card, CardHead, ErrorNote, Field, Notice, PageHead, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'

export default function ConsolePage() {
  const session = useApi(() => get('/api/opstack/session'), 'console')
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [networks, setNetworks] = useState(null)

  const data = session.data

  useEffect(() => {
    if (!data?.account) return
    get('/api/opstack/networks')
      .then(setNetworks)
      .catch(() => setNetworks(null))
  }, [data?.account])

  async function signIn(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await post('/api/opstack/login', form)
      session.reload()
    } catch (problem) {
      setError(problem.message || 'Could not sign in to the console.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await post('/api/opstack/logout', {})
    session.reload()
  }

  return (
    <div className="stack">
      <PageHead title="Opstack console" description="Platform-level console, separate from tenant permissions.">
        {data?.account ? (
          <Button icon="logout" onClick={signOut}>
            Sign out of console
          </Button>
        ) : null}
      </PageHead>

      <ErrorNote error={session.error} onRetry={session.reload} />
      {session.loading ? <Spinner label="Loading console" /> : null}

      {data && !data.configured ? (
        <Notice tone="warn">
          <Icon name="alert" size={17} />
          <span>The platform console is not configured on this server yet.</span>
        </Notice>
      ) : null}

      {data && data.configured && !data.account ? (
        <Card style={{ maxWidth: 460 }}>
          <CardHead title="Console sign-in" subtitle="Opstack owner or support account" />
          <form className="card-pad stack" onSubmit={signIn}>
            {error ? (
              <Notice tone="danger">
                <Icon name="alert" size={17} />
                <span>{error}</span>
              </Notice>
            ) : null}
            <Field label="Console username" htmlFor="console-username">
              <input id="console-username" className="input" autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
            </Field>
            <Field label="Password" htmlFor="console-password">
              <input id="console-password" className="input" type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            </Field>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      ) : null}

      {data?.account ? (
        <>
          <div className="grid grid-3">
            <Stat label="Signed in as" value={data.account.username} note={data.account.role} />
            <Stat label="Networks" value={number((networks?.networks || []).length)} />
            <Stat
              label="Monthly recurring"
              value={money((networks?.networks || []).reduce((sum, network) => sum + (network.monthlyCents || 0), 0))}
            />
          </div>

          <Card>
            <CardHead title="Networks" subtitle="Tenant workspaces on this server" />
            {!networks ? <Spinner label="Loading networks" /> : null}
            {networks?.networks?.length ? (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Network</th>
                      <th>Locations</th>
                      <th>Accounts</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {networks.networks.map((network) => (
                      <tr key={network.id}>
                        <td>
                          <strong>{network.name}</strong>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{network.slug || network.id}</div>
                        </td>
                        <td className="num">{number(network.locationCount)}</td>
                        <td className="num">{number(network.accountCount)}</td>
                        <td>
                          <span className={`badge ${network.active === false ? 'badge-danger' : 'badge-ok'}`}>
                            {network.active === false ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !networks && <div className="card-pad">Network summary is unavailable for this console account.</div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
