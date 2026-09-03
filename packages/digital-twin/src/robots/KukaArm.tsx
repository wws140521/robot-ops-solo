// KUKA 6 轴工业机器人 — 关节树版本
// 结构和 FANUC 一样：J1(Y) → J2(X) → J3(X) → J4(X) → J5(Y) → J6(X)
// KUKA 经典白色涂装，底座改成方形
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { JointTelemetry } from 'robot-adapter-kit'

interface Props {
  joints: JointTelemetry[]
  scale?: number
}

const KUKA_ORANGE = '#FF6600'
const KUKA_WHITE = '#F5F5F5'
const KUKA_DARK = '#2b3a5a'

const LINK = {
  baseH: 0.25,
  j1H: 0.15,
  j2Len: 0.30,
  j3Len: 0.22,
  j4Len: 0.10,
  j5Len: 0.08,
  j6Len: 0.06,
}

function getJointColor(loadPct: number, base: string): string {
  if (loadPct > 100) return '#ff3d71'
  if (loadPct > 80) return '#ffcc00'
  return base
}

// 和 FANUC 一样的关节枢轴+连杆结构，懒得再抽公共组件了
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
        <mesh castShadow position={[0, -length / 2, 0]}>
          <cylinderGeometry args={[thickness * 0.9, thickness, length, 16]} />
          <meshStandardMaterial
            color={jointColor}
            metalness={0.4}
            roughness={0.45}
          />
        </mesh>
        {children}
      </group>
    </group>
  )
}

export function KukaArm({ joints, scale = 1 }: Props) {
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
      {/* 方形底座（KUKA 特征） */}
      <mesh position={[0, LINK.baseH / 2, 0]} castShadow>
        <boxGeometry args={[0.18, LINK.baseH, 0.18]} />
        <meshStandardMaterial color={KUKA_WHITE} metalness={0.3} roughness={0.5} />
      </mesh>

      {/* J1 — 底座旋转（绕 Y） */}
      <JointWithLink
        position={[0, LINK.baseH, 0]}
        axis="y"
        targetAngle={j1?.angle_rad}
        length={LINK.j1H}
        thickness={0.06}
        color={KUKA_ORANGE}
        loadPct={j1?.load_pct ?? 0}
      >
        {/* J2 — 大臂摆动（绕 X） */}
        <JointWithLink
          position={[0, -LINK.j1H, 0]}
          axis="x"
          targetAngle={j2?.angle_rad}
          length={LINK.j2Len}
          thickness={0.045}
          color={KUKA_WHITE}
          loadPct={j2?.load_pct ?? 0}
        >
          {/* J3 — 小臂摆动（绕 X） */}
          <JointWithLink
            position={[0, -LINK.j2Len, 0]}
            axis="x"
            targetAngle={j3?.angle_rad}
            length={LINK.j3Len}
            thickness={0.035}
            color={KUKA_WHITE}
            loadPct={j3?.load_pct ?? 0}
          >
            {/* J4 — 腕部 1（绕 X） */}
            <JointWithLink
              position={[0, -LINK.j3Len, 0]}
              axis="x"
              targetAngle={j4?.angle_rad}
              length={LINK.j4Len}
              thickness={0.03}
              color={KUKA_DARK}
              loadPct={j4?.load_pct ?? 0}
            >
              {/* J5 — 腕部 2（绕 Y） */}
              <JointWithLink
                position={[0, -LINK.j4Len, 0]}
                axis="y"
                targetAngle={j5?.angle_rad}
                length={LINK.j5Len}
                thickness={0.025}
                color={KUKA_DARK}
                loadPct={j5?.load_pct ?? 0}
              >
                {/* J6 — 腕部 3（绕 X） */}
                <JointWithLink
                  position={[0, -LINK.j5Len, 0]}
                  axis="x"
                  targetAngle={j6?.angle_rad}
                  length={LINK.j6Len}
                  thickness={0.02}
                  color={KUKA_ORANGE}
                  loadPct={j6?.load_pct ?? 0}
                >
                  {/* 末端执行器（锥形，KUKA 特征） */}
                  <mesh castShadow position={[0, -LINK.j6Len - 0.03, 0]}>
                    <coneGeometry args={[0.025, 0.08, 8]} />
                    <meshStandardMaterial color={KUKA_ORANGE} metalness={0.6} roughness={0.3} />
                  </mesh>
                </JointWithLink>
              </JointWithLink>
            </JointWithLink>
          </JointWithLink>
        </JointWithLink>
      </JointWithLink>
    </group>
  )
}
