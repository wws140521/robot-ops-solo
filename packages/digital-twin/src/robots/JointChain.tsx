/**
 * 关节链原语组件
 * 遵循"group 枢轴 + mesh 偏移"的正确关节层级模式：
 *   JointPivot (group at joint origin)
 *     ├── 关节球 mesh (position [0,0,0])
 *     ├── 连杆 mesh (position [0, -length/2, 0])
 *     └── 下一级关节 (嵌套的 JointPivot)
 *
 * 驱动方式：useFrame lerp 将 group.rotation 平滑过渡到目标角度
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface JointChainProps {
  /** 目标旋转角（弧度），undefined 时不驱动 */
  targetAngle?: number
  /** 旋转轴 */
  axis?: 'x' | 'y' | 'z'
  /** lerp 平滑速度（越大越快，0=不插值） */
  speed?: number
  children?: React.ReactNode
}

/**
 * 单个关节枢轴 group：ref 挂在 group 上，useFrame 中 lerp 旋转
 * 旋转轴上的角度会平滑过渡到 targetAngle
 */
export function JointPivot({
  targetAngle,
  axis = 'x',
  speed = 8,
  children,
}: JointChainProps) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g || targetAngle === undefined) return
    const axisKey = axis as 'x' | 'y' | 'z'
    const current = g.rotation[axisKey]
    const next = THREE.MathUtils.lerp(current, targetAngle, delta * speed)
    g.rotation[axisKey] = next
  })

  return <group ref={groupRef}>{children}</group>
}

/**
 * 连杆：在关节 group 内沿 -Y 方向偏移 length/2
 * 这样 group 在关节处旋转时，连杆绕关节正确摆动
 */
export function LinkSegment({
  length,
  thickness = 0.04,
  color,
  metalness = 0.4,
  roughness = 0.5,
  castShadow = true,
  children,
}: {
  length: number
  thickness?: number
  color?: string
  metalness?: number
  roughness?: number
  castShadow?: boolean
  children?: React.ReactNode
}) {
  return (
    <mesh castShadow={castShadow} position={[0, -length / 2, 0]}>
      <cylinderGeometry args={[thickness * 0.8, thickness, length, 16]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
      {children}
    </mesh>
  )
}

/**
 * 关节球：在关节 group 原点显示一个球，根据健康分变色
 */
export function JointBall({
  radius = 0.04,
  color = '#2b3a5a',
  emissive,
  metalness = 0.5,
  roughness = 0.4,
  healthPct,
}: {
  radius?: number
  color?: string
  emissive?: string
  metalness?: number
  roughness?: number
  healthPct?: number
}) {
  const finalColor = healthPct !== undefined
    ? healthPct > 80
      ? color
      : healthPct > 50
        ? '#ffcc00'
        : '#ff3d71'
    : color

  return (
    <mesh castShadow position={[0, 0, 0]}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={finalColor}
        metalness={metalness}
        roughness={roughness}
        emissive={emissive ?? finalColor}
        emissiveIntensity={0.15}
      />
    </mesh>
  )
}
