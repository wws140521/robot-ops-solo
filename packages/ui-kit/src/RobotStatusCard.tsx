import type { UnifiedRobotState } from 'robot-adapter-kit'

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--status-online)',
  moving: 'var(--status-moving)',
  working: 'var(--status-working)',
  error: 'var(--status-error)',
  charging: 'var(--status-charging)',
}

const STATUS_LABELS: Record<string, string> = {
  idle: '空闲',
  moving: '移动中',
  working: '工作中',
  error: '故障',
  charging: '充电中',
}

interface Props {
  state: UnifiedRobotState
  onClick?: () => void
  compact?: boolean
}

export function RobotStatusCard({ state, onClick, compact }: Props) {
  const statusColor = STATUS_COLORS[state.status] ?? 'var(--text-tertiary)'
  const isIndustrial = !!state.industrial
  // 工业机器人显示关节负载率，商用机器人显示电量
  const pct = isIndustrial
    ? state.industrial?.joints?.[0]?.load_pct ?? 0
    : state.batteryPct
  const metricLabel = isIndustrial ? '负载' : '电量'
  const segments = 10

  return (
    <div
      className="robot-card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        padding: compact ? '10px 14px' : '16px',
        minWidth: compact ? 180 : 220,
      }}
    >
      <div className="robot-card__header">
        <div className="robot-card__id-row">
          <span
            className="robot-card__pulse-dot"
            style={{
              background: state.online ? statusColor : 'var(--status-offline)',
              boxShadow: state.online
                ? `0 0 6px ${statusColor}, 0 0 12px ${statusColor}`
                : 'none',
              animation: state.online ? 'pulse-dot 2s ease infinite' : 'none',
            }}
          />
          <span className="robot-card__id">{state.robotId}</span>
        </div>
        <span
          className="robot-card__status-pill"
          style={{
            background: statusColor + '22',
            border: `1px solid ${statusColor}`,
            color: statusColor,
          }}
        >
          {STATUS_LABELS[state.status] ?? state.status}
        </span>
      </div>

      {!compact && (
        <div className="robot-card__sub">
          {state.brand} · {state.model}
        </div>
      )}

      <div className="robot-card__battery">
        <div className="robot-card__battery-label">
          <span>{metricLabel}</span>
          <span style={{ color: pct < 20 ? 'var(--status-error)' : 'var(--text-secondary)' }}>
            {pct}%
          </span>
        </div>
        <div className="robot-card__battery-segments">
          {Array.from({ length: segments }).map((_, i) => {
            const filled = i < Math.round((pct / 100) * segments)
            const segColor =
              pct > 100
                ? 'var(--status-error)'
                : pct > 80
                  ? 'var(--alert-warn)'
                  : pct < 20
                    ? 'var(--status-error)'
                    : pct < 50
                      ? 'var(--status-working)'
                      : 'var(--status-online)'
            return (
              <div
                key={i}
                className="robot-card__battery-seg"
                style={{
                  background: filled ? segColor : 'var(--border-base)',
                  boxShadow: filled ? `0 0 4px ${segColor}44` : 'none',
                }}
              />
            )
          })}
        </div>
      </div>

      <div className="robot-card__pos">
        <span className="robot-card__pos-icon">📍</span>
        <span className="robot-card__pos-coord">
          ({state.position.x.toFixed(1)}, {state.position.y.toFixed(1)})
        </span>
        {!state.online && (
          <span className="robot-card__offline">● 离线</span>
        )}
      </div>

      {state.errorCode && !compact && (
        <div className="robot-card__error">
          错误码: {state.errorCode}
        </div>
      )}
    </div>
  )
}