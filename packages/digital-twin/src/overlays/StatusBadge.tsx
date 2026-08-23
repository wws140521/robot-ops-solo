import type { UnifiedRobotState } from 'robot-adapter-kit'
import type { CellType } from '../environment/collision'

interface StatusBadgeProps {
  state: UnifiedRobotState
  collision?: boolean
  cellType?: CellType | null
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--status-online)',
  moving: 'var(--status-moving)',
  working: 'var(--status-working)',
  error: 'var(--status-error)',
  charging: 'var(--status-charging)',
}

const CELL_LABEL: Record<CellType, string> = {
  wall: '墙体',
  table: '桌位',
  empty: '',
  out: '场外',
}

export function StatusBadge({ state, collision = false, cellType = null }: StatusBadgeProps) {
  const color = collision ? 'var(--status-error)' : STATUS_COLORS[state.status] ?? 'var(--status-offline)'
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: 'var(--text-primary)',
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: 13,
        whiteSpace: 'nowrap',
        border: collision ? '1px solid var(--status-error)' : '1px solid var(--border-base)',
        boxShadow: collision
          ? 'var(--glow-error), var(--shadow-card)'
          : 'var(--shadow-card)',
        pointerEvents: 'none',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 10px ${color}`,
          flexShrink: 0,
        }}
      />
      <span>
        <span style={{ fontWeight: 600 }}>{state.robotId}</span>
        <span style={{ opacity: 0.45, margin: '0 6px' }}>·</span>
        <span style={{ opacity: 0.9 }}>🔋 {state.batteryPct}%</span>
        <span style={{ opacity: 0.45, margin: '0 6px' }}>·</span>
        <span style={{ opacity: 0.9 }}>{state.status}</span>
        {collision && cellType && (
          <>
            <span style={{ opacity: 0.45, margin: '0 6px' }}>·</span>
            <span style={{ color: 'var(--status-error)', fontWeight: 700 }}>⚠ 穿模 · {CELL_LABEL[cellType]}</span>
          </>
        )}
      </span>
    </div>
  )
}
