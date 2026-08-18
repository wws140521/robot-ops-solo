import type { UnifiedAlert } from 'robot-adapter-kit'

const levelStyle: Record<UnifiedAlert['level'], { bg: string; border: string; icon: string }> = {
  info:  { bg: '#eff6ff', border: '#3b82f6', icon: 'ℹ️' },
  warn:  { bg: '#fefce8', border: '#eab308', icon: '⚠️' },
  error: { bg: '#fef2f2', border: '#ef4444', icon: '🚨' },
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
        <strong>{alert.robotId}</strong> · {alert.message}
      </span>
      <span style={{ color: '#9ca3af', fontSize: 11 }}>
        {new Date(alert.timestamp).toLocaleTimeString()}
      </span>
    </div>
  )
}
