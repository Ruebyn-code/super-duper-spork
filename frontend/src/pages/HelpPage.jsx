import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHead, PageHead, Search } from '../components/ui'
import Icon from '../components/Icon'

const guides = [
  {
    title: 'Place an order',
    body: 'Open Ordering, pick a supplier tab, add stock with Add or +. Quantities come from saved usage targets; adjust them in the cart. Review the estimated total, then Place order. Supplier messages are only sent where sending is configured.',
    to: '/',
    tags: 'ordering cart stock supplier',
  },
  {
    title: 'Count stock',
    body: 'Open Stock count → New count, enter the physical quantity for each item and save. Blank items are left untouched; a zero is a recorded zero. Saved counts are immutable snapshots.',
    to: '/stock-count',
    tags: 'stock count inventory',
  },
  {
    title: 'Record daily sales',
    body: 'Open Sales, choose the week and enter each day’s takings. Leave a day blank when it is not recorded. Saving updates projections, budgets and roster forecasts.',
    to: '/sales',
    tags: 'sales takings forecast',
  },
  {
    title: 'Publish a roster',
    body: 'Open Rostering for the selected location. Draft shifts are private until you publish the week; staff then see their own published shifts in My roster.',
    to: '/rostering',
    tags: 'roster shifts staff publish',
  },
  {
    title: 'Move stock between locations',
    body: 'Open Stock transfers → New transfer, choose the receiving location and quantities. The receiving site must confirm receipt before stock and usage change.',
    to: '/stock-transfers',
    tags: 'transfer stock location',
  },
  {
    title: 'Record wastage',
    body: 'Open Wastage → Record wastage. Choose items, a reason and quantities. Wastage is a log: it never deducts stock twice and can be voided with a reason.',
    to: '/wastage',
    tags: 'wastage waste stock cost',
  },
  {
    title: 'Invite a user',
    body: 'Open Accounts → Invite user. Choose the permission level and location. The new user gets an email link and chooses their own password; nothing is sent until you submit.',
    to: '/admin/accounts',
    tags: 'users accounts invite permission',
  },
  {
    title: 'Change company colours',
    body: 'Open App settings → Colours. Pick the primary and secondary colours and save; every screen picks them up immediately. Company colours stay readable in light and dark themes.',
    to: '/admin/settings',
    tags: 'appearance colours theme branding',
  },
]

export default function HelpPage() {
  const [term, setTerm] = useState('')
  const filtered = guides.filter((guide) =>
    !term.trim() ? true : `${guide.title} ${guide.tags} ${guide.body}`.toLowerCase().includes(term.toLowerCase()),
  )

  return (
    <div className="stack">
      <PageHead title="Help & support" description="Short, practical guides for the tasks you do most often.">
        <Search value={term} onChange={setTerm} placeholder="Search help" />
      </PageHead>

      <div className="grid grid-2">
        {filtered.map((guide) => (
          <Card key={guide.title}>
            <CardHead
              title={guide.title}
              actions={
                guide.to ? (
                  <Link className="btn btn-sm" to={guide.to}>
                    Open
                  </Link>
                ) : null
              }
            />
            <div className="card-pad">
              <p style={{ color: 'var(--text-soft)', fontSize: 13.5, lineHeight: 1.6 }}>{guide.body}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHead title="Still stuck?" subtitle="Support details" />
        <div className="card-pad stack">
          <div className="row" style={{ gap: 10 }}>
            <Icon name="mail" size={17} />
            <span style={{ fontSize: 13.5 }}>
              Send your Opstack contact the screen you were on, what you expected and what happened. Never share passwords or
              employee PINs.
            </span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Icon name="shield" size={17} />
            <span style={{ fontSize: 13.5 }}>Required reading posts must be read or snoozed before other screens unlock.</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
