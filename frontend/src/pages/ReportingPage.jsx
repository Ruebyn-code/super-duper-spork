import { useState } from 'react'
import { get } from '../lib/api'
import { useApi } from '../lib/useApi'
import { money, number, percent, dateLabel } from '../lib/format'
import { BarChart, Card, CardHead, ErrorNote, PageHead, Spinner, Stat, Tabs } from '../components/ui'
import { useSession } from '../context/SessionContext'

const presets = [
  { value: 'week', label: 'This week' },
  { value: 'last-week', label: 'Last week' },
  { value: 'four-weeks', label: '4 weeks' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'ytd', label: 'Year to date' },
]

export default function ReportingPage() {
  const { session } = useSession()
  const [preset, setPreset] = useState('four-weeks')
  const report = useApi(() => get(`/api/reporting?preset=${preset}`), preset)

  const summary = report.data?.summary
  const daily = Array.isArray(report.data?.daily) ? report.data.daily : []
  const profit = summary ? (summary.salesCents || 0) - (summary.orderCostCents || 0) : null
  const margin = summary && summary.salesCents ? ((profit / summary.salesCents) * 100).toFixed(1) : null

  return (
    <div className="stack">
      <PageHead title="Reporting" description={`${session?.locationName || ''} · sales, costs and margin for the selected period.`}>
        <Tabs value={preset} onChange={setPreset} options={presets} />
      </PageHead>

      <ErrorNote error={report.error} onRetry={report.reload} />
      {report.loading ? <Spinner label="Building report" /> : null}

      {summary ? (
        <div className="grid grid-4">
          <Stat label="Sales" value={money(summary.salesCents)} note={`${number(summary.recordedDays)} of ${number(summary.periodDays)} days recorded`} />
          <Stat label="Stock cost" value={money(summary.orderCostCents)} note={`${number(summary.orderCount)} orders`} />
          <Stat label="Gross profit" value={money(profit)} note={margin ? `${margin}% margin` : 'Margin unavailable'} />
          <Stat label="Cost ratio" value={percent(summary.expensePercent)} note={summary.pricePending ? 'Some prices pending' : 'Using saved prices'} />
        </div>
      ) : null}

      {daily.length ? (
        <div className="grid grid-2">
          <Card>
            <CardHead title="Daily sales" subtitle={report.data?.period ? `${dateLabel(report.data.period.start)} — ${dateLabel(report.data.period.end)}` : undefined} />
            <div className="card-pad">
              <BarChart
                data={daily.slice(-21).map((day) => ({
                  label: dateLabel(day.date, { day: 'numeric' }),
                  value: day.salesCents,
                }))}
                format={money}
              />
            </div>
          </Card>
          <Card>
            <CardHead title="Averages" subtitle={report.data?.averages ? `${number(report.data.averages.completedWeeks)} completed weeks` : undefined} />
            <div className="card-pad stack">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="stat-label">Average weekly sales</span>
                <strong>{money(report.data?.averages?.weeklySalesCents)}</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="stat-label">Average weekly cost</span>
                <strong>{money(report.data?.averages?.weeklyCostCents)}</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="stat-label">Weeks recorded</span>
                <strong>
                  {number(report.data?.averages?.weeksRecorded)} / {number(report.data?.averages?.completedWeeks)}
                </strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="stat-label">Daily budget</span>
                <strong>{money(summary?.budgetCents)}</strong>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {daily.length ? (
        <Card>
          <CardHead title="Daily breakdown" subtitle="Blank days are unknown, not zero" />
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Sales</th>
                  <th className="num">Cost</th>
                  <th className="num">Orders</th>
                  <th className="num">Cost ratio</th>
                </tr>
              </thead>
              <tbody>
                {daily.slice().reverse().map((day) => (
                  <tr key={day.date}>
                    <td>{dateLabel(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className="num">{day.salesCents == null ? '—' : money(day.salesCents)}</td>
                    <td className="num">{money(day.orderCostCents)}</td>
                    <td className="num">{number(day.orderCount)}</td>
                    <td className="num">{percent(day.expensePercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
