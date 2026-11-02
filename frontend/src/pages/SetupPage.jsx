import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { post } from '../lib/api'
import { Button, Field, Notice } from '../components/ui'
import Icon from '../components/Icon'

export default function SetupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await post('/api/setup', form)
      navigate('/login', { replace: true })
    } catch (problem) {
      setError(problem.message || 'Could not finish setup.')
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
          <h1>Set up the first Head Office account.</h1>
          <p>This account owns the first company, its locations and every permission level.</p>
        </div>
        <p style={{ fontSize: 12.5 }}>Opstack · first-run setup</p>
      </aside>

      <div className="auth-form-wrap">
        <div className="auth-card">
          <h2>Create the owner account</h2>
          <p>Passwords need 15–256 characters. Spaces and symbols are welcome.</p>
          <form onSubmit={submit}>
            {error ? (
              <Notice tone="danger">
                <Icon name="alert" size={17} />
                <span>{error}</span>
              </Notice>
            ) : null}
            <Field label="Username" htmlFor="setup-username">
              <input id="setup-username" className="input" autoFocus value={form.username} onChange={update('username')} required />
            </Field>
            <Field label="Password" htmlFor="setup-password">
              <input id="setup-password" className="input" type="password" value={form.password} onChange={update('password')} required />
            </Field>
            <Field label="Confirm password" htmlFor="setup-confirm">
              <input id="setup-confirm" className="input" type="password" value={form.confirmPassword} onChange={update('confirmPassword')} required />
            </Field>
            <Button type="submit" variant="primary" disabled={busy} style={{ minHeight: 44 }}>
              {busy ? 'Creating…' : 'Create account'}
            </Button>
          </form>
          <p style={{ marginTop: 18, fontSize: 13, color: 'var(--muted)' }}>
            First-time setup only works from the computer running the app. Already set up? <Link to="/login" style={{ color: 'var(--primary)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
