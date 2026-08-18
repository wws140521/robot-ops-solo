import type { UnifiedAlert } from 'robot-adapter-kit'

const LEVEL_COLORS: Record<string, string> = {
  info: 'var(--alert-info)',
  warn: 'var(--alert-warn)',
  error: 'var(--alert-error)',
}

const LEVEL_ICONS: Record<string, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '🚨',
}

interface Props {
  alert: UnifiedAlert
  onDismiss?: (id: string) => void
}

export function AlertItem({ alert, onDismiss }: Props) {
  const color = LEVEL_COLORS[alert.level] ?? 'var(--text-tertiary)'
  const time = new Date(alert.timestamp).toLocaleTimeString()

  return (
    <div
      className="alert-item"
      style={{
        borderLeft: `3px solid ${color}`,
        background: `${color}11`,
      }}
    >
      <span
        className="alert-item__icon"
        style={{
          background: `${color}22`,
          color,
        }}
      >
        {LEVEL_ICONS[alert.level]}
      </span>

      <div className="alert-item__content">
        <span className="alert-item__robot-id">{alert.robotId}</span>
        <span className="alert-item__msg">{alert.message}</span>
      </div>

      <div className="alert-item__meta">
        <span className="alert-item__time">{time}</span>
        {onDismiss && (
          <button
            className="alert-item__close"
            onClick={() => onDismiss(alert.robotId)}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}