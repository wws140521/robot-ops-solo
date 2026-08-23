type StatusType = 'online' | 'offline' | 'warn' | 'error' | 'doing' | 'todo'

const STATUS_MAP: Record<StatusType, { color: string; glow: boolean; label: string }> = {
  online:  { color: 'var(--status-online)', glow: true,  label: '在线' },
  offline: { color: 'var(--status-offline)', glow: false, label: '离线' },
  warn:    { color: 'var(--status-working)', glow: true,  label: '警告' },
  error:   { color: 'var(--status-error)', glow: true,  label: '错误' },
  doing:   { color: 'var(--neon)', glow: true,  label: '进行中' },
  todo:    { color: 'var(--text-muted)', glow: false, label: '待执行' },
}

export function StatusDot({ status, size = 8, showLabel = false }: {
  status: StatusType
  size?: number
  showLabel?: boolean
}) {
  const cfg = STATUS_MAP[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '50%',
          background: cfg.color,
          boxShadow: cfg.glow ? `0 0 8px ${cfg.color}` : 'none',
          animation: cfg.glow ? 'ng-pulse 2s infinite' : 'none',
        }}
      />
      {showLabel && (
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{cfg.label}</span>
      )}
    </span>
  )
}
