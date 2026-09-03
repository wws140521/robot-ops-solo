/**
 * eVTOL 起降场地面设施卡片
 */
import type { UnifiedRobotState } from 'robot-adapter-kit'

interface VertiportCardProps {
  device: UnifiedRobotState
}

function healthColor(score: number): string {
  if (score >= 80) return 'var(--status-online)'
  if (score >= 60) return 'var(--alert-warn)'
  return 'var(--status-error)'
}

export function VertiportCard({ device }: VertiportCardProps) {
  const { vertiport } = device
  const score = device.batteryPct ?? 85

  return (
    <div
      className="card hud-corners"
      style={{
        padding: 14,
        borderTop: '2px solid var(--primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              background: 'var(--primary)',
              color: '#fff',
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
            起降场 · {device.online ? '在线' : '离线'}
          </span>
        </div>
      </div>

      {vertiport && (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>充电坪</span>
          <span>{vertiport.chargingPadState}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>充电电流</span>
          <span>{vertiport.chargingCurrentA.toFixed(1)}A</span>
          <span style={{ color: 'var(--text-tertiary)' }}>消防</span>
          <span>{vertiport.fireSuppression}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>照明</span>
          <span>{vertiport.lighting}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>地面电源</span>
          <span>{vertiport.groundPowerVoltageV.toFixed(1)}V</span>
        </div>
      )}
    </div>
  )
}
