import { useEffect, useRef } from 'react'
import Icon from './Icon'

export function Card({ children, className = '', ...rest }) {
  return (
    <section className={`card ${className}`} {...rest}>
      {children}
    </section>
  )
}

export function CardHead({ title, subtitle, actions }) {
  return (
    <header className="card-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <div className="card-title-sub">{subtitle}</div> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </header>
  )
}

export function PageHead({ title, description, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </div>
  )
}

export function Button({ variant = 'default', size, icon, children, ...rest }) {
  const classes = ['btn']
  if (variant === 'primary') classes.push('btn-primary')
  if (variant === 'ghost') classes.push('btn-ghost')
  if (variant === 'danger') classes.push('btn-danger')
  if (size === 'sm') classes.push('btn-sm')
  return (
    <button type="button" className={classes.join(' ')} {...rest}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  )
}

export function Field({ label, hint, children, htmlFor }) {
  return (
    <label className="field" htmlFor={htmlFor}>
      {label ? <span>{label}</span> : null}
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function Notice({ tone = '', children }) {
  return <div className={`notice ${tone}`}>{children}</div>
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="row" style={{ padding: 24, color: 'var(--muted)', fontSize: 13.5 }}>
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null
  return (
    <Notice tone="danger">
      <Icon name="alert" size={17} />
      <div style={{ flex: 1 }}>{error.message || String(error)}</div>
      {onRetry ? (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Notice>
  )
}

export function Stat({ label, value, note, delta, tone }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone ? { color: `var(--${tone})` } : undefined}>
        {value}
      </div>
      {note ? <div className="stat-note">{note}</div> : null}
      {delta ? <div className={`stat-delta ${delta.tone || ''}`}>{delta.text}</div> : null}
    </div>
  )
}

export function Tabs({ options, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`tab ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Search({ value, onChange, placeholder = 'Search', onSubmit }) {
  // Rendered as a div so it can sit inside a page form without nesting forms.
  return (
    <div className="search">
      <Icon name="search" size={16} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onSubmit) {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
    </div>
  )
}

export function Modal({ title, children, footer, onClose, wide, labelledBy = 'dialog-title' }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const previouslyFocused = document.activeElement
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={dialogRef}>
        <header className="dialog-head">
          <h2 id={labelledBy}>{title}</h2>
          <button type="button" className="icon-btn push" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={17} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer ? <footer className="dialog-foot">{footer}</footer> : null}
      </div>
    </div>
  )
}

export function BarChart({ data, format = (value) => value }) {
  const max = Math.max(...data.map((point) => Number(point.value) || 0), 1)
  return (
    <div className="bar-chart" role="img" aria-label="Bar chart">
      {data.map((point) => {
        const height = point.value ? Math.max(4, (Number(point.value) / max) * 100) : 0
        return (
          <div className="bar-col" key={point.label} title={`${point.label}: ${format(point.value)}`}>
            <div
              className={`bar ${point.value ? '' : 'empty-bar'}`}
              style={{ height: `${point.value ? height : 4}%` }}
            />
            <small>{point.label}</small>
          </div>
        )
      })}
    </div>
  )
}

export function Progress({ value, max = 100, tone }) {
  const pct = max ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0
  return (
    <div className={`progress ${tone || ''}`}>
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}
