import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { Button, Field, Notice } from '../components/ui'
import Icon from '../components/Icon'

export default function LoginPage() {
  const { session, signIn, loading } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [networkCode, setNetworkCode] = useState('')
  const [needsNetwork, setNeedsNetwork] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const returnTo = new URLSearchParams(location.search).get('returnTo') || '/home'

  useEffect(() => {
    if (!loading && session) navigate(returnTo, { replace: true })
  }, [loading, session, navigate, returnTo])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn({ username, password, networkCode })
      navigate(returnTo, { replace: true })
    } catch (problem) {
      if (problem.status === 409) setNeedsNetwork(true)
      setError(problem.message || 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div>
          <div className="brand" style={{ padding: 0 }}>
            <img src="/favicon.png" alt="" />
            Opstack<span>.</span>
          </div>
          <h1>Everything your venue runs on, in one place.</h1>
          <p>Ordering, stock, sales, rosters and compliance — scoped to the location you are working in.</p>
          <ul className="auth-list">
            {[
              'Order from suppliers with live usage targets',
              'Count stock, track wastage and move stock between sites',
              'Rosters, timesheets and award checks in one view',
            ].map((line) => (
              <li key={line}>
                <Icon name="check" size={17} />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p style={{ fontSize: 12.5 }}>Opstack · signed-in workspace</p>
      </aside>

      <div className="auth-form-wrap">
        <div className="auth-card">
          <h2>Sign in</h2>
          <p>Use the account your manager set up for you.</p>
          <form onSubmit={submit}>
            {error ? (
              <Notice tone="danger">
                <Icon name="alert" size={17} />
                <span>{error}</span>
              </Notice>
            ) : null}
            <Field label="Username or email" htmlFor="username">
              <input
                id="username"
                className="input"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
            {needsNetwork ? (
              <Field label="Network code" hint="These details belong to more than one network." htmlFor="network">
                <input
                  id="network"
                  className="input"
                  value={networkCode}
                  onChange={(event) => setNetworkCode(event.target.value)}
                />
              </Field>
            ) : null}
            <Button type="submit" variant="primary" disabled={busy} style={{ minHeight: 44 }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p style={{ marginTop: 18, fontSize: 13, color: 'var(--muted)' }}>
            New here? Your invitation email contains a setup link. <Link to="/setup" style={{ color: 'var(--primary)' }}>First-time setup</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
