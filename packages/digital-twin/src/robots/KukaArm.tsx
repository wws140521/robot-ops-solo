/**
 * KUKA 6 轴工业机器人简易 3D 模型
 * 风格偏白色机身（KUKA 经典配色）
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { JointTelemetry } from 'robot-adapter-kit'

interface Props {
  joints: JointTelemetry[]
  scale?: number
}

const KUKA_ORANGE = '#FF6600'
const KUKA_WHITE = '#F5F5F5'

export function KukaArm({ joints, scale = 1 }: Props) {
  const refs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ]

  useFrame((_, delta) => {
    joints.forEach((j, i) => {
      const ref = refs[i]?.current
      if (!ref) return
      const mat = ref.material as THREE.MeshStandardMaterial
      const intensity = Math.min(j.load_pct / 100, 1)
      mat.color.setRGB(1, 1 - intensity * 0.6, 1 - intensity)
      const speed = (j.speed_rpm || 0) * 0.01
      ref.rotation.z += speed * delta
    })
  })

  return (
    <group scale={scale}>
      {/* 方形底座（KUKA 特征） */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.35, 0.3, 0.35]} />
        <meshStandardMaterial color={KUKA_WHITE} metalness={0.3} />
      </mesh>

      {/* J1 */}
      <group position={[0, 0.35, 0]}>
        <mesh ref={refs[0]} position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.3, 16]} />
          <meshStandardMaterial color={KUKA_ORANGE} />
        </mesh>

        {/* J2 */}
        <group position={[0, 0.3, 0]}>
          <mesh ref={refs[1]} position={[0, 0.2, 0]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <meshStandardMaterial color={KUKA_WHITE} />
          </mesh>

          {/* J3 */}
          <group position={[0, 0.4, 0]}>
            <mesh ref={refs[2]} position={[0, 0.15, 0]}>
              <boxGeometry args={[0.06, 0.3, 0.06]} />
              <meshStandardMaterial color={KUKA_WHITE} />
            </mesh>

            {/* J4 末端 */}
            <group position={[0, 0.3, 0]}>
              <mesh ref={refs[3]}>
                <coneGeometry args={[0.05, 0.15, 8]} />
                <meshStandardMaterial color={KUKA_ORANGE} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
