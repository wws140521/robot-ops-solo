import { Html } from '@react-three/drei'
import type { UnifiedRobotState } from 'robot-adapter-kit'

interface HUDLabelProps {
  position: [number, number, number]
  robot: UnifiedRobotState
  accentColor: string
  primaryColor: string
}

/**
 * 3D 空间锚定 HUD 标签
 * —— 用 drei Html 将 2D DOM 标签固定在 3D 机器人位置上方
 * —— distanceFactor 随距离自动缩放，避免远处标签过大
 * —— occlude="blending" 被物体遮挡时自动半透明
 */
export function HUDLabel({ position, robot, accentColor, primaryColor }: HUDLabelProps) {
  const statusColor =
    robot.status === 'error' ? '#ff3d71' :
    robot.status === 'moving' ? accentColor :
    robot.status === 'charging' ? '#ffc107' :
    robot.status === 'working' ? '#7c4dff' :
    primaryColor

  const batteryColor = robot.batteryPct > 20 ? statusColor : '#ff3d71'

  return (
    <Html
      position={position}
      center
      distanceFactor={4}
      occlude="blending"
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: 'rgba(10, 14, 26, 0.88)',
          border: `1px solid ${statusColor}`,
          borderRadius: 6,
          padding: '6px 10px',
          color: '#e2e8f0',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 11,
          whiteSpace: 'nowrap',
          boxShadow: `0 0 10px ${statusColor}55`,
          backdropFilter: 'blur(4px)',
          minWidth: 96,
        }}
      >
        <div style={{ color: statusColor, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
          ● {robot.robotId}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
          <span style={{ color: '#64748b' }}>BRAND</span>
          <span>{robot.brand}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
          <span style={{ color: '#64748b' }}>STATUS</span>
          <span style={{ color: statusColor }}>{robot.status.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: '#64748b' }}>BAT</span>
          <span style={{ color: batteryColor }}>{robot.batteryPct.toFixed(1)}%</span>
        </div>
      </div>
    </Html>
  )
}
