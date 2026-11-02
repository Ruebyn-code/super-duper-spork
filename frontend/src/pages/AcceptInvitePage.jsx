import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { post } from '../lib/api'
import { Button, Field, Notice } from '../components/ui'
import Icon from '../components/Icon'

export default function AcceptInvitePage() {
  const [search] = useSearchParams()
  const token = search.get('token') || ''
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('This setup link is missing its token.')
      return
    }
    post('/api/invitations/inspect', { token })
      .then(setInvitation)
      .catch((problem) => setError(problem.message || 'This setup link is no longer valid.'))
  }, [token])

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await post('/api/invitations/accept', { token, ...form })
      navigate('/login', { replace: true })
    } catch (problem) {
      setError(problem.message || 'Could not activate the account.')
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
          <h1>Choose your password and join the team.</h1>
          <p>Your access, locations and permissions are already prepared by your manager.</p>
        </div>
        <p style={{ fontSize: 12.5 }}>Opstack · account setup</p>
      </aside>

      <div className="auth-form-wrap">
        <div className="auth-card">
          <h2>{invitation ? `Welcome, ${invitation.username || invitation.name || 'teammate'}` : 'Activate your account'}</h2>
          <p>Passwords need 15–256 characters.</p>
          <form onSubmit={submit}>
            {error ? (
              <Notice tone="danger">
                <Icon name="alert" size={17} />
                <span>{error}</span>
              </Notice>
            ) : null}
            <Field label="Password" htmlFor="invite-password">
              <input id="invite-password" className="input" type="password" autoFocus value={form.password} onChange={update('password')} required />
            </Field>
            <Field label="Confirm password" htmlFor="invite-confirm">
              <input id="invite-confirm" className="input" type="password" value={form.confirmPassword} onChange={update('confirmPassword')} required />
            </Field>
            <Button type="submit" variant="primary" disabled={busy || !token} style={{ minHeight: 44 }}>
              {busy ? 'Activating…' : 'Activate account'}
            </Button>
          </form>
          <p style={{ marginTop: 18, fontSize: 13, color: 'var(--muted)' }}>
            <Link to="/login" style={{ color: 'var(--primary)' }}>Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
