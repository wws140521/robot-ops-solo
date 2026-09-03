/**
 * 无人机机巢卡片
 */
import type { UnifiedRobotState } from 'robot-adapter-kit'

interface DockCardProps {
  device: UnifiedRobotState
}

function healthColor(score: number): string {
  if (score >= 80) return 'var(--status-online)'
  if (score >= 60) return 'var(--alert-warn)'
  return 'var(--status-error)'
}

function statusColor(status: string): string {
  if (status === 'error') return 'var(--status-error)'
  if (status === 'charging') return 'var(--status-charging)'
  return 'var(--status-online)'
}

export function DockCard({ device }: DockCardProps) {
  const { dock, uav } = device
  const score = device.batteryPct ?? 85

  return (
    <div
      className="card hud-corners"
      style={{
        padding: 14,
        borderTop: '2px solid var(--status-charging)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              background: 'var(--status-charging)',
              color: '#000',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            {device.brand}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {device.model}
          </span>
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {device.robotId}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            border: `2px solid ${healthColor(score)}`,
            color: healthColor(score),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
            boxShadow: `0 0 10px ${healthColor(score)}33`,
          }}
        >
          {score}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>健康分</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            机巢 · {device.online ? '在线' : '离线'}
          </span>
          {dock && (
            <span style={{ fontSize: 11, color: statusColor(device.status), fontFamily: 'var(--font-mono)' }}>
              {dock.dockState}
            </span>
          )}
        </div>
      </div>

      {dock && (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>充电器</span>
          <span>{dock.chargerTempC}℃ / {dock.chargerCurrentA.toFixed(1)}A</span>
          <span style={{ color: 'var(--text-tertiary)' }}>舱门</span>
          <span>{dock.doorState}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>升降台</span>
          <span>{dock.liftPlatform}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>风速</span>
          <span>{dock.weather.windSpeedMps} m/s</span>
          <span style={{ color: 'var(--text-tertiary)' }}>温度</span>
          <span>{dock.weather.temperatureC}℃</span>
        </div>
      )}

      {uav && (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>无人机电量</span>
          <span>{uav.batteryPct}%</span>
          <span style={{ color: 'var(--text-tertiary)' }}>电池循环</span>
          <span>{uav.batteryCycles}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>信号</span>
          <span>{uav.signalRssi} dBm</span>
        </div>
      )}
    </div>
  )
}
