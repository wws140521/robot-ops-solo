import { useMemo } from 'react'
import { Line } from '@react-three/drei'

interface GlowTrajectoryProps {
  points: { x: number; y: number }[]
  color?: string
}

export function GlowTrajectory({ points, color = '#4a9eff' }: GlowTrajectoryProps) {
  const pts = useMemo(
    () => points.map((p) => [p.x, 0.08, p.y] as [number, number, number]),
    [points],
  )

  if (pts.length < 2) return null

  return (
    <>
      <Line
        points={pts}
        color={color}
        lineWidth={4}
        transparent
        opacity={0.2}
        dashed
        dashSize={0.25}
        gapSize={0.1}
      />
      <Line
        points={pts}
        color={color}
        lineWidth={2}
        transparent
        opacity={0.85}
      />
    </>
  )
}