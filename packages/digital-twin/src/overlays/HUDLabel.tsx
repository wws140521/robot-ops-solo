import { Html } from '@react-three/drei'
import type { UnifiedRobotState } from 'robot-adapter-kit'

interface HUDLabelProps {
  position: [number, number, number]
  robot: UnifiedRobotState
  accentColor: string
  primaryColor: string
}

// 3D 空间里的 HUD 标签，钉在机器人头顶
// 用 drei Html 把 2D DOM 固定到 3D 位置，远处会自动缩小
// 被物体挡住时会半透明（occlude="blending"）
export function HUDLabel({ position, robot, accentColor, primaryColor }: HUDLabelProps) {
  const statusColor =
    robot.status === 'error' ? '#ff3d71' :
    robot.status === 'moving' ? accentColor :
    robot.status === 'charging' ? '#ffc107' :
    robot.status === 'working' ? '#7c4dff' :
    primaryColor

  // 2026-09-09 工业臂市电供电没有电池，显示 0.0% 会被误读成「没电故障」，改显 N/A
  const batteryColor = robot.batteryPct > 20 ? statusColor : '#ff3d71'

  return (
    <Html
      position={position}
      center
      // 2026-09-09 修复 resize 空白/错位：原「屏幕投影 + distanceFactor + occlude blending」组合在
      // 容器尺寸变化时 translate 与 scale 分两帧更新、遮挡检测短暂失准，会出现空白标签。
      // 改用 transform（CSS 3D 变换）+ sprite（始终面向相机）：DOM 直接跟随 world matrix
      // 做透视变换，缩放天然跟随场景，无投影同步问题；去掉 occlude，舰队俯瞰视角标签
      // 本来就钉在头顶上方，几乎没有被机身遮挡的场景，换取全尺寸稳定。
      // distanceFactor 在 transform 模式下是 DOM→世界单位换算（1 DOM px ≈ distanceFactor/400 m）。
      transform
      sprite
      // 2026-09-09 实测校准：distanceFactor=4 时 1 DOM px ≈ 1cm，全景机位（距产线 ~16m）
      // 下工业臂卡片屏显仅 76~116px、有效字号 5~8px，勉强可读。放大到 5.5（≈+37%），
      // 远景字号回到 8~11px 舒适区，近处移动机器人标签也不至于夸张。
      distanceFactor={5.5}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: 'rgba(10, 14, 26, 0.88)',
          border: `1px solid ${statusColor}`,
          borderRadius: 6,
          padding: '7px 11px',
          color: '#e2e8f0',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 12,
          whiteSpace: 'nowrap',
          boxShadow: `0 0 10px ${statusColor}55`,
          backdropFilter: 'blur(4px)',
          minWidth: 110,
        }}
      >
        <div style={{ color: statusColor, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
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
          <span style={{ color: batteryColor }}>
            {robot.industrial ? 'N/A' : `${robot.batteryPct.toFixed(1)}%`}
          </span>
        </div>
      </div>
    </Html>
  )
}
