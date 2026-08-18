import type { UnifiedRobotState } from 'robot-adapter-kit'
import type { CellType } from '../environment/collision'

interface StatusBadgeProps {
  state: UnifiedRobotState
  collision?: boolean
  cellType?: CellType | null
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#52c41a',
  moving: '#1890ff',
  working: '#fa8c16',
  error: '#f5222d',
  charging: '#722ed1',
}

const CELL_LABEL: Record<CellType, string> = {
  wall: '墙体',
  table: '桌位',
  empty: '',
  out: '场外',
}

export function StatusBadge({ state, collision = false, cellType = null }: StatusBadgeProps) {
  const color = collision ? '#ff1744' : STATUS_COLORS[state.status] ?? '#999'
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
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: '#1e293b',
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: 13,
        whiteSpace: 'nowrap',
        border: collision ? '1px solid #ff1744' : '1px solid rgba(0,0,0,0.08)',
        boxShadow: collision
          ? '0 0 18px rgba(255,23,68,0.35), 0 4px 16px rgba(0,0,0,0.12)'
          : '0 4px 16px rgba(0,0,0,0.12)',
        pointerEvents: 'none',
        fontFamily: 'system-ui, -apple-system, sans-serif',
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
            <span style={{ color: '#ff5a6e', fontWeight: 700 }}>⚠ 穿模 · {CELL_LABEL[cellType]}</span>
          </>
        )}
      </span>
    </div>
  )
}
