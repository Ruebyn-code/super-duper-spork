const moneyFormat = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 2,
})

export function money(cents) {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) return '—'
  return moneyFormat.format(Number(cents) / 100)
}

export function number(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('en-AU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(Number(value))
}

export function percent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(digits)}%`
}

export function dateLabel(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-AU', { ...options, timeZone: 'Australia/Melbourne' }).format(date)
}

export function dayLabel(value) {
  return dateLabel(value, { weekday: 'short', day: 'numeric' })
}

export function timeLabel(value) {
  return dateLabel(value, { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function relative(value) {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return dateLabel(value, { day: 'numeric', month: 'short' })
}

export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  )
}

export function titleCase(value = '') {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
