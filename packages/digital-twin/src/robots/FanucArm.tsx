/**
 * FANUC 6 轴工业机器人简易 3D 模型
 * POC 阶段用圆柱体+长方体表示连杆，关节角度驱动旋转
 * 负载率高时颜色偏红，正常时橙色
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { JointTelemetry } from 'robot-adapter-kit'

interface Props {
  joints: JointTelemetry[]
  scale?: number
}

const JOINT_COLORS = {
  normal: '#FF6600',
  warning: '#FFCC00',
  danger: '#FF2222',
}

function getLoadColor(loadPct: number): string {
  if (loadPct > 100) return JOINT_COLORS.danger
  if (loadPct > 80) return JOINT_COLORS.warning
  return JOINT_COLORS.normal
}

export function FanucArm({ joints, scale = 1 }: Props) {
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
      mat.color.set(getLoadColor(j.load_pct))
      const speed = (j.speed_rpm || 0) * 0.01
      ref.rotation.z += speed * delta
    })
  })

  return (
    <group scale={scale}>
      {/* 基座 */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.2, 24]} />
        <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* J1 - 旋转底座 */}
      <group position={[0, 0.22, 0]}>
        <mesh ref={refs[0]} position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.3, 16]} />
          <meshStandardMaterial color={JOINT_COLORS.normal} />
        </mesh>

        {/* J2 - 大臂 */}
        <group position={[0, 0.3, 0]}>
          <mesh ref={refs[1]} position={[0, 0.25, 0]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.1, 0.5, 0.1]} />
            <meshStandardMaterial color={JOINT_COLORS.normal} />
          </mesh>

          {/* J3 - 小臂 */}
          <group position={[0, 0.5, 0]}>
            <mesh ref={refs[2]} position={[0, 0.2, 0]}>
              <boxGeometry args={[0.08, 0.4, 0.08]} />
              <meshStandardMaterial color={JOINT_COLORS.normal} />
            </mesh>

            {/* J4 末端 */}
            <group position={[0, 0.4, 0]}>
              <mesh ref={refs[3]}>
                <sphereGeometry args={[0.06, 12, 12]} />
                <meshStandardMaterial color={JOINT_COLORS.normal} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* 品牌标签环 */}
      <mesh position={[0, -0.05, 0]}>
        <ringGeometry args={[0.25, 0.3, 32]} />
        <meshBasicMaterial color="#FF6600" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
