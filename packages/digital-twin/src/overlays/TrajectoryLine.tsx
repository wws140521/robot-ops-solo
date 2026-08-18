import { useMemo } from 'react'
import { Line } from '@react-three/drei'

interface TrajectoryLineProps {
  points: { x: number; y: number }[]
  color?: string
}

// 机器人历史轨迹（drei Line 支持屏幕空间线宽，比 lineBasicMaterial 清晰）
export function TrajectoryLine({ points, color = '#37c2ff' }: TrajectoryLineProps) {
  const pts = useMemo(
    () => points.map((p) => [p.x, 0.06, p.y] as [number, number, number]),
    [points],
  )

  if (pts.length < 2) return null

  return (
    <Line
      points={pts}
      color={color}
      lineWidth={3}
      transparent
      opacity={0.85}
      dashed
      dashSize={0.22}
      gapSize={0.12}
    />
  )
}
