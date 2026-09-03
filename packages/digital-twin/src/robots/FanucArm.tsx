// FANUC 6 轴工业机器人 — 关节树版本
// 关节层级：Base → J1(Y) → J2(X) → J3(X) → J4(X) → J5(Y) → J6(X) → 末端执行器
// 每个关节是一个 group（枢轴在关节原点），连杆 mesh 在 group 内沿 -Y 偏移 halfLength
// useFrame 里用 lerp 驱动 group 旋转，这样关节才会绕自己的枢轴转
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { JointTelemetry } from 'robot-adapter-kit'

interface Props {
  joints: JointTelemetry[]
  scale?: number
}

const FANUC_ORANGE = '#FF6600'
const FANUC_DARK = '#1a1a1a'
const FANUC_METAL = '#2b3a5a'

// 连杆参数（单位米，按 M-20iD/25 近似比例瞎估的）
const LINK = {
  baseH: 0.25,
  j1H: 0.15,
  j2Len: 0.35,  // 大臂
  j3Len: 0.25,  // 小臂
  j4Len: 0.12,  // 腕部 1
  j5Len: 0.10,  // 腕部 2
  j6Len: 0.08,  // 腕部 3
}

function getJointColor(loadPct: number, base = FANUC_ORANGE): string {
  if (loadPct > 100) return '#ff3d71'
  if (loadPct > 80) return '#ffcc00'
  return base
}

// 单关节枢轴 + 连杆组合件
function JointWithLink({
  position,
  axis,
  targetAngle,
  length,
  thickness = 0.035,
  color,
  loadPct = 0,
  speed = 8,
  children,
}: {
  position: [number, number, number]
  axis: 'x' | 'y' | 'z'
  targetAngle?: number
  length: number
  thickness?: number
  color: string
  loadPct?: number
  speed?: number
  children?: React.ReactNode
}) {
  const groupRef = useRef<THREE.Group>(null)
  const jointColor = getJointColor(loadPct, color)

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g || targetAngle === undefined) return
    const key = axis as 'x' | 'y' | 'z'
    g.rotation[key] = THREE.MathUtils.lerp(g.rotation[key], targetAngle, delta * speed)
  })

  return (
    <group position={position}>
      <group ref={groupRef}>
        {/* 关节球 */}
        <mesh castShadow position={[0, 0, 0]}>
          <sphereGeometry args={[thickness * 1.2, 16, 16]} />
          <meshStandardMaterial
            color={jointColor}
            metalness={0.5}
            roughness={0.4}
            emissive={jointColor}
            emissiveIntensity={0.2}
          />
        </mesh>
        {/* 连杆：沿 -Y 偏移 length/2，group 旋转时连杆绕关节摆动 */}
        <mesh castShadow position={[0, -length / 2, 0]}>
          <cylinderGeometry args={[thickness * 0.9, thickness, length, 16]} />
          <meshStandardMaterial
            color={jointColor}
            metalness={0.5}
            roughness={0.35}
          />
        </mesh>
        {/* 下一级关节（嵌套） */}
        {children}
      </group>
    </group>
  )
}

export function FanucArm({ joints, scale = 1 }: Props) {
  // 按关节号索引，未提供时默认 0
  const j = useMemo(() => {
    const map = new Map<number, JointTelemetry>()
    joints.forEach((jt) => map.set(jt.j, jt))
    return map
  }, [joints])

  const j1 = j.get(1)
  const j2 = j.get(2)
  const j3 = j.get(3)
  const j4 = j.get(4)
  const j5 = j.get(5)
  const j6 = j.get(6)

  return (
    <group scale={scale}>
      {/* 基座 */}
      <mesh position={[0, LINK.baseH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, LINK.baseH, 24]} />
        <meshStandardMaterial color={FANUC_DARK} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* J1 — 底座旋转（绕 Y） */}
      <JointWithLink
        position={[0, LINK.baseH, 0]}
        axis="y"
        targetAngle={j1?.angle_rad}
        length={LINK.j1H}
        thickness={0.06}
        color={FANUC_ORANGE}
        loadPct={j1?.load_pct ?? 0}
      >
        {/* J2 — 大臂摆动（绕 X） */}
        <JointWithLink
          position={[0, -LINK.j1H, 0]}
          axis="x"
          targetAngle={j2?.angle_rad}
          length={LINK.j2Len}
          thickness={0.05}
          color={FANUC_ORANGE}
          loadPct={j2?.load_pct ?? 0}
        >
          {/* J3 — 小臂摆动（绕 X） */}
          <JointWithLink
            position={[0, -LINK.j2Len, 0]}
            axis="x"
            targetAngle={j3?.angle_rad}
            length={LINK.j3Len}
            thickness={0.04}
            color={FANUC_METAL}
            loadPct={j3?.load_pct ?? 0}
          >
            {/* J4 — 腕部 1（绕 X） */}
            <JointWithLink
              position={[0, -LINK.j3Len, 0]}
              axis="x"
              targetAngle={j4?.angle_rad}
              length={LINK.j4Len}
              thickness={0.035}
              color={FANUC_METAL}
              loadPct={j4?.load_pct ?? 0}
            >
              {/* J5 — 腕部 2（绕 Y） */}
              <JointWithLink
                position={[0, -LINK.j4Len, 0]}
                axis="y"
                targetAngle={j5?.angle_rad}
                length={LINK.j5Len}
                thickness={0.03}
                color={FANUC_METAL}
                loadPct={j5?.load_pct ?? 0}
              >
                {/* J6 — 腕部 3（绕 X） */}
                <JointWithLink
                  position={[0, -LINK.j5Len, 0]}
                  axis="x"
                  targetAngle={j6?.angle_rad}
                  length={LINK.j6Len}
                  thickness={0.025}
                  color={FANUC_ORANGE}
                  loadPct={j6?.load_pct ?? 0}
                >
                  {/* 末端执行器 */}
                  <mesh castShadow position={[0, -LINK.j6Len, 0]}>
                    <cylinderGeometry args={[0.02, 0.03, 0.06, 12]} />
                    <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
                  </mesh>
                </JointWithLink>
              </JointWithLink>
            </JointWithLink>
          </JointWithLink>
        </JointWithLink>
      </JointWithLink>

      {/* 品牌标识环 */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.22, 32]} />
        <meshBasicMaterial color={FANUC_ORANGE} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
