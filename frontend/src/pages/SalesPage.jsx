import { useEffect, useMemo, useState } from 'react'
import { get, put } from '../lib/api'
import { useApi } from '../lib/useApi'
import { money, number, percent, dateLabel } from '../lib/format'
import { Button, Card, CardHead, ErrorNote, Notice, PageHead, Spinner, Stat, BarChart } from '../components/ui'
import Icon from '../components/Icon'

const centsToInput = (cents) => (cents === null || cents === undefined ? '' : (cents / 100).toFixed(2))
const inputToCents = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null
}

function shiftWeek(weekStart, weeks) {
  const date = new Date(`${weekStart}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return date.toISOString().slice(0, 10)
}

export default function SalesPage() {
  const [week, setWeek] = useState('')
  const sales = useApi(() => get(`/api/sales${week ? `?week=${week}` : ''}`), week)
  const [days, setDays] = useState(Array(7).fill(''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const record = sales.data?.record
  const projection = sales.data?.projection

  useEffect(() => {
    if (!record) return
    setWeek((current) => current || record.weekStart)
    setDays((record.days || []).map(centsToInput))
  }, [record])

  const weekDates = useMemo(() => {
    if (!record?.weekStart) return []
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${record.weekStart}T00:00:00Z`)
      date.setUTCDate(date.getUTCDate() + index)
      return date.toISOString().slice(0, 10)
    })
  }, [record?.weekStart])

  const total = days.reduce((sum, value) => sum + (inputToCents(value) || 0), 0)
  const chart = days.map((value, index) => ({
    label: weekDates[index] ? dateLabel(weekDates[index], { weekday: 'short' }) : String(index + 1),
    value: inputToCents(value),
  }))

  async function save() {
    setBusy(true)
    setError('')
    setSaved('')
    try {
      await put('/api/sales', {
        weekStart: record.weekStart,
        days: days.map(inputToCents),
        revision: record.revision,
      })
      setSaved('Daily sales saved.')
      sales.reload()
    } catch (problem) {
      setError(problem.message || 'Could not save sales.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <PageHead title="Sales" description="Enter daily takings for the selected location. Blank days stay unknown; zero means a recorded zero.">
        <Button icon="chevronRight" onClick={() => setWeek(shiftWeek(record?.weekStart || week || new Date().toISOString().slice(0, 10), 1))}>
          Next week
        </Button>
        <Button onClick={save} variant="primary" disabled={busy || !record}>
          {busy ? 'Saving…' : 'Save week'}
        </Button>
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

      <div className="grid grid-4">
        <Stat label="This week" value={money(total)} note={record ? `Week of ${dateLabel(record.weekStart)}` : 'Loading…'} />
        <Stat
          label="Actual so far"
          value={projection ? money(projection.performance?.actualCents) : '—'}
          note={projection ? `${number(projection.performance?.recordedDays)} days recorded` : ''}
        />
        <Stat
          label="Expected by now"
          value={projection ? money(projection.performance?.expectedCents) : '—'}
          note={projection?.performance?.missingDays ? `${number(projection.performance.missingDays)} days missing` : ''}
        />
        <Stat
          label="Variance"
          value={projection ? money(projection.performance?.differenceCents) : '—'}
          note={projection ? percent(projection.performance?.differencePercent) : ''}
          tone={(projection?.performance?.differenceCents || 0) < 0 ? 'danger' : 'ok'}
        />
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHead
            title="Daily entry"
            subtitle={record ? `${dateLabel(record.weekStart)} — ${dateLabel(weekDates[6] || record.weekStart)}` : undefined}
            actions={
              <Button size="sm" variant="ghost" onClick={() => setWeek(shiftWeek(record?.weekStart || week, -1))}>
                Previous
              </Button>
            }
          />
          {sales.loading ? <Spinner label="Loading sales" /> : null}
          <ErrorNote error={sales.error} onRetry={sales.reload} />
          {record ? (
            <div className="card-pad stack">
              {weekDates.map((date, index) => (
                <div className="row" key={date}>
                  <span style={{ width: 110, color: 'var(--text-soft)', fontSize: 13.5 }}>
                    {dateLabel(date, { weekday: 'long' })}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 12.5, width: 92 }}>{dateLabel(date, { day: 'numeric', month: 'short' })}</span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    aria-label={`Takings for ${dateLabel(date)}`}
                    style={{ textAlign: 'right', maxWidth: 160, marginLeft: 'auto' }}
                    value={days[index] ?? ''}
                    onChange={(event) => {
                      const next = [...days]
                      next[index] = event.target.value
                      setDays(next)
                    }}
                    placeholder="Not recorded"
                  />
                </div>
              ))}
              <div className="total-row grand">
                <span>Week total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHead title="Week shape" subtitle="Recorded takings by day" />
          <div className="card-pad">
            <BarChart data={chart} format={money} />
            {projection?.salesReason ? (
              <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 12 }}>{projection.salesReason}</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
