import { useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { relative, dateLabel, initials } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Field, Notice, PageHead, Spinner, Tabs } from '../components/ui'
import Icon from '../components/Icon'

export default function CommunicationsPage() {
  const { session, can } = useSession()
  const [tab, setTab] = useState('posts')
  const posts = useApi(() => get('/api/communications/posts'), 'posts')
  const threads = useApi(() => get('/api/communications/threads'), 'threads')
  const unread = useApi(() => get('/api/communications/unread'), 'unread')
  const [openThread, setOpenThread] = useState(null)
  const messages = useApi(
    () => (openThread ? get(`/api/communications/threads/${openThread}`) : Promise.resolve(null)),
    openThread || 'none',
    { enabled: Boolean(openThread) },
  )
  const [draft, setDraft] = useState({ title: '', body: '', requireRead: false })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const postList = posts.data?.posts || []
  const threadList = threads.data?.threads || []

  async function markRead(post) {
    try {
      await post(`/api/communications/posts/${post.id}/read`, { revision: post.revision })
      posts.reload()
      unread.reload()
    } catch (problem) {
      setError(problem.message || 'Could not mark this post read.')
    }
  }

  async function publish(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await post('/api/communications/posts', {
        title: draft.title,
        body: draft.body,
        scope: 'company',
        requireRead: draft.requireRead,
        requestId: crypto.randomUUID(),
      })
      setDraft({ title: '', body: '', requireRead: false })
      posts.reload()
    } catch (problem) {
      setError(problem.message || 'Could not publish the post.')
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!message.trim() || !openThread) return
    try {
      await post(`/api/communications/threads/${openThread}/messages`, { body: message, requestId: crypto.randomUUID() })
      setMessage('')
      messages.reload()
    } catch (problem) {
      setError(problem.message || 'Could not send the message.')
    }
  }

  return (
    <div className="stack">
      <PageHead title="Communications" description="Company posts, required reading and team chats.">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'posts', label: `Posts${postList.length ? ` · ${postList.length}` : ''}` },
            { value: 'chats', label: `Chats${threadList.length ? ` · ${threadList.length}` : ''}` },
          ]}
        />
      </PageHead>

      {error ? (
        <Notice tone="danger">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </Notice>
      ) : null}

      {tab === 'posts' ? (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 360px', alignItems: 'start' }}>
          <Card>
            <CardHead
              title="Posts"
              subtitle={unread.data ? `${unread.data.unread} unread` : undefined}
              actions={
                <Button size="sm" variant="ghost" icon="refresh" onClick={posts.reload}>
                  Refresh
                </Button>
              }
            />
            {posts.loading ? <Spinner label="Loading posts" /> : null}
            <ErrorNote error={posts.error} onRetry={posts.reload} />
            {!posts.loading && !postList.length ? <Empty title="Nothing posted yet">Company updates will appear here.</Empty> : null}
            {postList.map((entry) => (
              <article className="post" key={entry.id}>
                <div className="post-head">
                  <span className="avatar">{initials(entry.authorName)}</span>
                  <div className="list-main">
                    <strong style={{ fontSize: 14 }}>{entry.title}</strong>
                    <div className="post-meta">
                      {entry.authorName} · {relative(entry.createdAt)}
                    </div>
                  </div>
                  {entry.requireRead ? <span className="badge badge-warn">Required</span> : null}
                  {entry.read ? <span className="badge badge-ok">Read</span> : null}
                </div>
                <div className="post-body">{entry.body}</div>
                {!entry.read ? (
                  <div style={{ marginTop: 10 }}>
                    <Button size="sm" onClick={() => markRead(entry)}>
                      Mark as read
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </Card>

          <Card>
            <CardHead title="New post" subtitle="Company audience" />
            {can('comms.post.company') ? (
              <form className="card-pad stack" onSubmit={publish}>
                <Field label="Title" htmlFor="post-title">
                  <input id="post-title" className="input" maxLength={140} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
                </Field>
                <Field label="Message" htmlFor="post-body">
                  <textarea id="post-body" className="input" rows={6} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} required />
                </Field>
                <label className="row" style={{ gap: 8, fontSize: 13.5 }}>
                  <input
                    type="checkbox"
                    checked={draft.requireRead}
                    onChange={(event) => setDraft({ ...draft, requireRead: event.target.checked })}
                    disabled={!can('comms.require')}
                  />
                  Require everyone to read this
                </label>
                <Button type="submit" variant="primary" disabled={busy} icon="mail">
                  {busy ? 'Publishing…' : 'Publish post'}
                </Button>
              </form>
            ) : (
              <Empty title="Read-only access">Your permission level can read posts but not publish them.</Empty>
            )}
          </Card>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '300px minmax(0, 1fr)', alignItems: 'start' }}>
          <Card>
            <CardHead title="Conversations" subtitle={`${threadList.length} chats`} />
            {threads.loading ? <Spinner /> : <ErrorNote error={threads.error} onRetry={threads.reload} />}
            {!threads.loading && !threadList.length ? <Empty title="No chats yet" /> : null}
            {threadList.map((thread) => (
              <button
                type="button"
                key={thread.id}
                className="list-row"
                style={{ width: '100%', background: openThread === thread.id ? 'var(--surface-3)' : 'transparent', border: 0, borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => setOpenThread(thread.id)}
              >
                <div className="list-main">
                  <strong>{thread.name || 'Conversation'}</strong>
                  <small>{thread.kind === 'direct' ? 'Direct message' : 'Group'} · {relative(thread.updatedAt)}</small>
                </div>
                {thread.unread ? <span className="nav-badge">{thread.unread}</span> : null}
              </button>
            ))}
          </Card>

          <Card style={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
            <CardHead title={threadList.find((thread) => thread.id === openThread)?.name || 'Select a conversation'} />
            <div className="card-pad" style={{ flex: 1, overflow: 'auto' }}>
              {!openThread ? <Empty title="Pick a conversation">Choose a chat to read its messages.</Empty> : null}
              {messages.loading ? <Spinner /> : <ErrorNote error={messages.error} onRetry={messages.reload} />}
              {(Array.isArray(messages.data?.messages) ? messages.data.messages : []).map((entry) => (
                <div key={entry.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="post-meta">
                    {entry.authorName || entry.username || session?.username} · {dateLabel(entry.createdAt, { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <div className="post-body">{entry.body}</div>
                </div>
              ))}
            </div>
            {openThread ? (
              <form className="composer" onSubmit={sendMessage}>
                <div className="row">
                  <input className="input" placeholder="Write a message" value={message} onChange={(event) => setMessage(event.target.value)} />
                  <Button type="submit" variant="primary" disabled={!message.trim()}>
                    Send
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  )
}
