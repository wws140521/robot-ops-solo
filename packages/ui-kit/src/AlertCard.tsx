import type { UnifiedAlert } from 'robot-adapter-kit'

const levelStyle: Record<UnifiedAlert['level'], { bg: string; border: string; icon: string }> = {
  info:  { bg: 'var(--accent-dim)', border: 'var(--alert-info)', icon: 'ℹ️' },
  warn:  { bg: 'rgba(255, 209, 102, 0.12)', border: 'var(--alert-warn)', icon: '⚠️' },
  error: { bg: 'rgba(255, 107, 107, 0.12)', border: 'var(--alert-error)', icon: '🚨' },
}

export function AlertCard({ alert }: { alert: UnifiedAlert }) {
  const s = levelStyle[alert.level]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: 6,
      background: s.bg, borderLeft: `3px solid ${s.border}`,
      fontSize: 12, marginBottom: 4,
    }}>
      <span>{s.icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <strong style={{ color: 'var(--text-primary)' }}>{alert.robotId}</strong>
        <span style={{ color: 'var(--text-secondary)' }}> · {alert.message}</span>
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
        {new Date(alert.timestamp).toLocaleTimeString()}
      </span>
    </div>
  )
}
