import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

interface GlowTrajectoryProps {
  points: { x: number; y: number }[]
  color?: string
}

// GlowTrajectory - 发光轨迹线
// 用 AdditiveBlending 做深科技感发光效果
// 双层：外层虚线光晕 + 内层实线核心
export function GlowTrajectory({ points, color = '#4a9eff' }: GlowTrajectoryProps) {
  const pts = useMemo(
    () => points.map((p) => [p.x, 0.08, p.y] as [number, number, number]),
    [points],
  )

  if (pts.length < 2) return null

  return (
    <>
      {/* 外层光晕 - 虚线 + 加法混合 */}
      <Line
        points={pts}
        color={color}
        lineWidth={4}
        transparent
        opacity={0.25}
        dashed
        dashSize={0.25}
        gapSize={0.1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
      {/* 内层实线 - 加法混合 + 高不透明度核心 */}
      <Line
        points={pts}
        color={color}
        lineWidth={2}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </>
  )
}