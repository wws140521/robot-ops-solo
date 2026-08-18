import type { UnifiedRobotState } from 'robot-adapter-kit'

const statusColor: Record<UnifiedRobotState['status'], string> = {
  idle: '#6b7280',
  moving: '#3b82f6',
  working: '#22c55e',
  error: '#ef4444',
  charging: '#eab308',
}

const statusLabel: Record<UnifiedRobotState['status'], string> = {
  idle: '空闲', moving: '移动中', working: '工作中',
  error: '故障', charging: '充电中',
}

export function RobotCard({
  robot,
  onClick,
  active,
}: {
  robot: UnifiedRobotState
  onClick?: () => void
  active?: boolean
}) {
  const color = statusColor[robot.status]
  return (
    <div
      onClick={onClick}
      style={{
        border: `2px solid ${active ? color : 'var(--border-base)'}`,
        borderRadius: 10, padding: 12, cursor: 'pointer',
        background: active ? `${color}15` : 'var(--bg-elev-2)',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
          {robot.robotId}
        </div>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: color, boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
        {robot.brand} · {robot.model}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12 }}>
        <span>🔋 {robot.batteryPct}%</span>
        <span style={{ color }}>{statusLabel[robot.status]}</span>
      </div>
      {robot.errorCode && (
        <div style={{ fontSize: 11, color: 'var(--status-error)', marginTop: 4 }}>
          错误码: {robot.errorCode}
        </div>
      )}
    </div>
  )
}
