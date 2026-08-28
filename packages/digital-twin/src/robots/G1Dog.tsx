/**
 * 宇树 G1 四足机器人 — 关节树版本
 * 每条腿构建两级关节链：hip（绕 X）→ knee（绕 X）
 *
 * 结构：
 *   机身
 *     ├── 前左腿：hip_l → knee_l
 *     ├── 前右腿：hip_r → knee_r
 *     ├── 后左腿：hip_l_back → knee_l_back
 *     └── 后右腿：hip_r_back → knee_r_back
 *
 * joints prop 格式：Record<string, number>（来自 WS 数据）
 *   hip_l, hip_r, knee_l, knee_r, hip_l_back, hip_r_back, knee_l_back, knee_r_back
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

interface G1DogProps {
  position: [number, number, number]
  rotation: [number, number, number]
  joints?: Record<string, number>
  scale?: number
}

const BODY_COLOR = '#e6edf7'
const METAL_COLOR = '#2b3a5a'
const DARK_COLOR = '#0c1322'

const TORSO_LEN = 1.0
const HIP_OFFSET_Y = 0.34  // 关节相对机身底部的 Y 偏移
const THIGH_LEN = 0.16     // 大腿长度
const SHIN_LEN = 0.18      // 小腿长度
const HIP_THICKNESS = 0.04
const SHIN_THICKNESS = 0.035

/** 单腿：hip 枢轴 → thigh mesh → knee 枢轴 → shin mesh → foot */
function Leg({
  hipAngle,
  kneeAngle,
  hipX,
  hipZ,
  speed = 8,
}: {
  hipAngle?: number
  kneeAngle?: number
  hipX: number
  hipZ: number
  speed?: number
}) {
  const hipRef = useRef<THREE.Group>(null)
  const kneeRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (hipRef.current && hipAngle !== undefined) {
      hipRef.current.rotation.x = THREE.MathUtils.lerp(hipRef.current.rotation.x, hipAngle, delta * speed)
    }
    if (kneeRef.current && kneeAngle !== undefined) {
      kneeRef.current.rotation.x = THREE.MathUtils.lerp(kneeRef.current.rotation.x, kneeAngle, delta * speed)
    }
  })

  return (
    <group position={[hipX, -HIP_OFFSET_Y, hipZ]}>
      {/* Hip 枢轴 — 大腿绕此关节旋转 */}
      <group ref={hipRef}>
        {/* 大腿 mesh：沿 -Y 偏移 THIGH_LEN/2 */}
        <mesh castShadow position={[0, -THIGH_LEN / 2, 0]}>
          <cylinderGeometry args={[HIP_THICKNESS * 0.8, HIP_THICKNESS, THIGH_LEN, 16]} />
          <meshStandardMaterial color={METAL_COLOR} metalness={0.55} roughness={0.38} />
        </mesh>
        {/* 大腿关节球 */}
        <mesh castShadow position={[0, 0, 0]}>
          <sphereGeometry args={[HIP_THICKNESS, 16, 16]} />
          <meshStandardMaterial color={METAL_COLOR} metalness={0.55} roughness={0.38} />
        </mesh>

        {/* Knee 枢轴 — 小腿绕此关节旋转 */}
        <group ref={kneeRef} position={[0, -THIGH_LEN, 0]}>
          {/* 小腿 mesh：沿 -Y 偏移 SHIN_LEN/2 */}
          <mesh castShadow position={[0, -SHIN_LEN / 2, 0]}>
            <cylinderGeometry args={[SHIN_THICKNESS * 0.8, SHIN_THICKNESS, SHIN_LEN, 16]} />
            <meshStandardMaterial color={DARK_COLOR} metalness={0.3} roughness={0.6} />
          </mesh>
          {/* 膝关节球 */}
          <mesh castShadow position={[0, 0, 0]}>
            <sphereGeometry args={[SHIN_THICKNESS * 0.8, 16, 16]} />
            <meshStandardMaterial color={DARK_COLOR} metalness={0.3} roughness={0.6} />
          </mesh>

          {/* 脚端球 */}
          <mesh castShadow position={[0, -SHIN_LEN, 0]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshStandardMaterial color={DARK_COLOR} metalness={0.2} roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// 4 条腿的位置配置（相对机身中心）
const LEG_CONFIG = [
  { key: 'fl', x: -0.24, z: 0.32, hipKey: 'hip_fl', kneeKey: 'knee_fl' },
  { key: 'fr', x: 0.24, z: 0.32, hipKey: 'hip_fr', kneeKey: 'knee_fr' },
  { key: 'rl', x: -0.24, z: -0.32, hipKey: 'hip_rl', kneeKey: 'knee_rl' },
  { key: 'rr', x: 0.24, z: -0.32, hipKey: 'hip_rr', kneeKey: 'knee_rr' },
]

// 兼容旧版 key 名（hip_l/hip_r/knee_l/knee_r）
const LEG_COMPAT: Record<string, { hip: string; knee: string }> = {
  fl: { hip: 'hip_l', knee: 'knee_l' },
  fr: { hip: 'hip_r', knee: 'knee_r' },
  rl: { hip: 'hip_l', knee: 'knee_l' },
  rr: { hip: 'hip_r', knee: 'knee_r' },
}

export function G1Dog({ position, rotation, joints, scale = 0.5 }: G1DogProps) {
  const getAngle = (primaryKey: string, compatKey: string): number | undefined => {
    if (!joints) return undefined
    const val = joints[primaryKey]
    if (val !== undefined) return val
    return joints[compatKey]
  }

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* 机身 */}
      <RoundedBox args={[0.7, 0.28, TORSO_LEN]} radius={0.08} smoothness={4} position={[0, 0.42, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={BODY_COLOR} metalness={0.55} roughness={0.32} />
      </RoundedBox>
      {/* 腰部灯带 */}
      <mesh position={[0, 0.43, 0]}>
        <boxGeometry args={[0.72, 0.05, 0.5]} />
        <meshStandardMaterial color="#1890ff" emissive="#1890ff" emissiveIntensity={0.6} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* 传感器头部 */}
      <RoundedBox args={[0.24, 0.18, 0.24]} radius={0.06} smoothness={4} position={[0, 0.52, 0.52]} castShadow>
        <meshStandardMaterial color={DARK_COLOR} metalness={0.6} roughness={0.3} emissive="#3ba0ff" emissiveIntensity={0.5} />
      </RoundedBox>

      {/* 4 条腿 — 每条腿独立的 hip→knee 两级关节链 */}
      {LEG_CONFIG.map(({ key, x, z, hipKey, kneeKey }) => {
        const compat = LEG_COMPAT[key]
        return (
          <Leg
            key={key}
            hipX={x}
            hipZ={z}
            hipAngle={getAngle(hipKey, compat.hip)}
            kneeAngle={getAngle(kneeKey, compat.knee)}
          />
        )
      })}
    </group>
  )
}
