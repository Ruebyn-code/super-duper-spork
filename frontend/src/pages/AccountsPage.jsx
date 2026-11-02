import { useMemo, useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { number, initials } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Field, Modal, Notice, PageHead, Search, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'

export default function AccountsPage() {
  const { session, can } = useSession()
  const accounts = useApi(() => get('/api/accounts'), 'accounts')
  const levels = useApi(() => get('/api/permission-levels'), 'levels')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState({
    username: '',
    email: '',
    role: '',
    locationId: session?.locationId || '',
    phoneNumber: '',
  })

  const list = Array.isArray(accounts.data) ? accounts.data : []
  const filtered = list.filter((account) =>
    !term.trim() ? true : `${account.username} ${account.email || ''}`.toLowerCase().includes(term.toLowerCase()),
  )
  const assignable = useMemo(
    () => (levels.data?.levels || []).filter((level) => level.assignable !== false),
    [levels.data],
  )

  async function invite(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await post('/api/accounts', {
        username: draft.username,
        email: draft.email,
        phoneNumber: draft.phoneNumber || undefined,
        role: draft.role || assignable[0]?.id,
        roleScope: 'company',
        companyId: session.companyId,
        locationId: draft.locationId || session.locationId,
        locationIds: [draft.locationId || session.locationId],
      })
      setOpen(false)
      setDraft({ username: '', email: '', role: '', locationId: session?.locationId || '', phoneNumber: '' })
      accounts.reload()
    } catch (problem) {
      setError(problem.message || 'Could not invite this user.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageHead title="Accounts & permissions" description="Users, permission levels and location access for this company.">
        {can('users.create') || can('users.manage') ? (
          <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
            Invite user
          </Button>
        ) : null}
      </PageHead>

      <div className="grid grid-4">
        <Stat label="Users" value={number(list.length)} />
        <Stat label="Pending invitations" value={number(list.filter((account) => account.invitation).length)} />
        <Stat label="Permission levels" value={number(assignable.length)} />
        <Stat label="Locations" value={number(session?.locations?.length || 0)} />
      </div>

      <ErrorNote error={accounts.error} onRetry={accounts.reload} />
      {accounts.loading ? <Spinner label="Loading accounts" /> : null}

      <Card>
        <CardHead title="Users" subtitle="Names, permission levels and sign-in state" actions={<Search value={term} onChange={setTerm} placeholder="Search users" />} />
        {!accounts.loading && !filtered.length ? <Empty title="No users found">Invite your team to give them access.</Empty> : null}
        {filtered.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Permission level</th>
                  <th>Locations</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div className="row">
                        <span className="avatar">{initials(account.username)}</span>
                        <span>
                          <strong>{account.username}</strong>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{account.email || 'No email'}</div>
                        </span>
                      </div>
                    </td>
                    <td>{account.roleName || account.role}</td>
                    <td>
                      <div className="row-wrap" style={{ gap: 4 }}>
                        {(account.locationIds || []).map((id) => (
                          <span className="badge" key={id}>
                            {session?.locations?.find((location) => location.id === id)?.name || id.slice(0, 6)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {account.invitation ? (
                        <span className="badge badge-warn">Invited</span>
                      ) : (
                        <span className="badge badge-ok">{account.active === false ? 'Inactive' : 'Active'}</span>
                      )}
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
          title="Invite a user"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={invite} disabled={busy}>
                {busy ? 'Sending…' : 'Send invitation'}
              </Button>
            </>
          }
        >
          <form className="stack" onSubmit={invite}>
            {error ? <ErrorNote error={new Error(error)} /> : null}
            <Field label="Name" htmlFor="invite-name">
              <input id="invite-name" className="input" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} required />
            </Field>
            <Field label="Email" hint="The invitation link is sent to this address." htmlFor="invite-email">
              <input id="invite-email" className="input" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required />
            </Field>
            <Field label="Phone" hint="Optional. The last four digits become the clock PIN." htmlFor="invite-phone">
              <input id="invite-phone" className="input" value={draft.phoneNumber} onChange={(event) => setDraft({ ...draft, phoneNumber: event.target.value })} />
            </Field>
            <div className="grid grid-2">
              <Field label="Permission level" htmlFor="invite-role">
                <select id="invite-role" className="input" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
                  {assignable.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Location" htmlFor="invite-location">
                <select id="invite-location" className="input" value={draft.locationId} onChange={(event) => setDraft({ ...draft, locationId: event.target.value })}>
                  {(session?.locations || []).map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Notice tone="info">
              <Icon name="mail" size={17} />
              <span>New users choose their own password from the invitation email.</span>
            </Notice>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
