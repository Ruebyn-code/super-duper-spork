import { useState } from 'react'
import { get, post } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useSession } from '../context/SessionContext'
import { relative, dateLabel } from '../lib/format'
import { Button, Card, CardHead, Empty, ErrorNote, Field, Modal, Notice, PageHead, Search, Spinner, Tabs } from '../components/ui'
import Icon from '../components/Icon'

export default function KnowledgeLibraryPage() {
  const { can } = useSession()
  const [category, setCategory] = useState('all')
  const [term, setTerm] = useState('')
  const library = useApi(() => get('/api/knowledge-library'), 'library')
  const [open, setOpen] = useState(null)
  const detail = useApi(() => (open ? get(`/api/knowledge-library/${open}`) : Promise.resolve(null)), open || 'none', {
    enabled: Boolean(open),
  })
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ title: '', body: '', categoryId: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const data = library.data
  const categories = data?.categories || []
  const articles = (data?.articles || []).filter((article) => {
    if (category !== 'all' && article.categoryId !== category) return false
    if (!term.trim()) return true
    return `${article.title} ${article.summary || ''}`.toLowerCase().includes(term.toLowerCase())
  })

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await post('/api/knowledge-library', {
        title: draft.title,
        body: draft.body,
        categoryId: draft.categoryId || undefined,
        requestId: crypto.randomUUID(),
      })
      setCreating(false)
      setDraft({ title: '', body: '', categoryId: '' })
      library.reload()
    } catch (problem) {
      setError(problem.message || 'Could not save the article.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageHead title="Knowledge library" description="Company reference articles, guides and how-tos.">
        {can('knowledge.manage.company') ? (
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            New article
          </Button>
        ) : null}
      </PageHead>

      {error ? (
        <Notice tone="danger">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </Notice>
      ) : null}

      <Card>
        <div className="card-pad row-wrap" style={{ gap: 14 }}>
          <Search value={term} onChange={setTerm} placeholder="Search the library" />
          <Tabs
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: 'All categories' }, ...categories.map((entry) => ({ value: entry.id, label: entry.name }))]}
          />
        </div>
      </Card>

      <ErrorNote error={library.error} onRetry={library.reload} />
      {library.loading ? <Spinner label="Loading library" /> : null}

      <div className="grid grid-3">
        {articles.map((article) => (
          <button
            type="button"
            key={article.id}
            className="card card-pad"
            style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
            onClick={() => setOpen(article.id)}
          >
            <span className="badge badge-primary">{article.categoryName || 'Article'}</span>
            <strong style={{ fontSize: 15.5 }}>{article.title}</strong>
            {article.summary ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>{article.summary}</span> : null}
            <span style={{ color: 'var(--muted)', fontSize: 12, marginTop: 'auto' }}>Updated {relative(article.updatedAt)}</span>
          </button>
        ))}
      </div>

      {!library.loading && !articles.length ? (
        <Card>
          <Empty title="No articles yet">Reference material added by managers will appear here.</Empty>
        </Card>
      ) : null}

      {open ? (
        <Modal title={detail.data?.title || 'Article'} onClose={() => setOpen(null)} wide>
          {detail.loading ? <Spinner /> : <ErrorNote error={detail.error} />}
          {detail.data ? (
            <div className="stack">
              <div className="row-wrap">
                <span className="badge badge-primary">{detail.data.categoryName || 'Article'}</span>
                <span className="badge">{dateLabel(detail.data.updatedAt)}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.65 }}>{detail.data.body}</div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {creating ? (
        <Modal
          title="New article"
          onClose={() => setCreating(false)}
          wide
          footer={
            <>
              <Button onClick={() => setCreating(false)}>Cancel</Button>
              <Button variant="primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save article'}
              </Button>
            </>
          }
        >
          <form className="stack" onSubmit={save}>
            <Field label="Title" htmlFor="article-title">
              <input id="article-title" className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
            </Field>
            <Field label="Category" htmlFor="article-category">
              <select
                id="article-category"
                className="input"
                value={draft.categoryId}
                onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
              >
                <option value="">Uncategorised</option>
                {categories.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Article" htmlFor="article-body">
              <textarea
                id="article-body"
                className="input"
                rows={10}
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                required
              />
            </Field>
            {error ? <ErrorNote error={new Error(error)} /> : null}
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
