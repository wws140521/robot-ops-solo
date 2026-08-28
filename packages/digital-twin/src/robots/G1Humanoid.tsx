/**
 * G1Humanoid.tsx
 * 宇树 G1 29 DOF 人形机器人 — URDF 等比例还原版 v3
 *
 * 结构（严格对齐 g1_29dof.urdf）：
 *   Pelvis
 *     ├── waist_yaw(Y) → waist_roll(X) → waist_pitch(Z) → Torso → Head(固定)
 *     │   ├── L ShoulderPitch(Z) → Roll(X) → Yaw(Y) → Elbow(Z) → WristRoll(X) → WristPitch(Z) → WristYaw(Y) → Hand
 *     │   └── R ShoulderPitch(Z) → Roll(X) → Yaw(Y) → Elbow(Z) → WristRoll(X) → WristPitch(Z) → WristYaw(Y) → Hand
 *     ├── L HipPitch(Z) → Roll(X) → Yaw(Y) → Knee(Z) → AnklePitch(Z) → AnkleRoll(X) → Foot
 *     └── R HipPitch(Z) → Roll(X) → Yaw(Y) → Knee(Z) → AnklePitch(Z) → AnkleRoll(X) → Foot
 *
 * 坐标轴映射（URDF Z-up → Three.js Y-up）：
 *   URDF (1,0,0) → axis="x"  (roll 类)
 *   URDF (0,1,0) → axis="z"  (pitch 类)
 *   URDF (0,0,1) → axis="y"  (yaw 类)
 *
 * 坐标转换：three(x, y, z) = (-urdf_y, urdf_z, urdf_x)
 *   即：URDF +Z(上) → Three.js +Y(上)，URDF +X(前) → Three.js +Z(前)，URDF +Y(左) → Three.js -X(右)
 *
 * v3 修复：重构几何构建方式，采用显式 position 累积替代 quaternion 嵌套
 *   - 每个关节的 position 直接设置到累积偏移位置
 *   - 连杆 mesh 用显式 position + quaternion 对齐 offset 方向
 *   - 子关节 group 在父关节的 offset 末端，确保位置链完整传递
 *
 * 29 DOF = 腰部3 + 双臂14 + 双腿12
 *
 * L1 几何校验（Box3）：身高 ≈ 1.30m，肩关中心距 ≈ 0.20m
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { JointPivot } from './JointChain'

interface G1HumanoidProps {
  position: [number, number, number]
  rotation: [number, number, number]
  joints?: Record<string, number>
  scale?: number
}

// ─── 外观参数 ───────────────────────────────────────────
const BODY_COLOR = '#e6edf7'
const METAL_COLOR = '#2b3a5a'
const DARK_COLOR = '#0c1322'
const ACCENT = '#1890ff'

// ─── 骨盆/躯干尺寸（米） ────────────────────────────────
const PELVIS_H = 0.12
const PELVIS_W = 0.30
const PELVIS_D = 0.22
const TORSO_H = 0.35
const TORSO_W = 0.26
const TORSO_D = 0.18
const HEAD_R = 0.08

// ─── 关节球半径 ────────────────────────────────────────
const JOINT_R_SHOULDER = 0.045
const JOINT_R_ELBOW = 0.035
const JOINT_R_WRIST = 0.025
const JOINT_R_HIP = 0.05
const JOINT_R_KNEE = 0.04
const JOINT_R_ANKLE = 0.025

// ─── 连杆厚度 ──────────────────────────────────────────
const ARM_THICK = 0.025
const FOREARM_THICK = 0.022
const LEG_THICK = 0.035
const CALF_THICK = 0.030

// ─── URDF 真实关节 origin（Three.js Y-up 坐标，单位米） ───
// 转换公式：three(x, y, z) = (-urdf_y, urdf_z, urdf_x)

// 腰部链（相对 pelvis）
const WAIST_ROLL_POS: [number, number, number] = [0.000000, 0.035000, -0.003964]
const WAIST_PITCH_POS: [number, number, number] = [0.000000, 0.019000, 0.000000]

// 躯干 frame 下的关节 origin
const L_SHOULDER_PITCH_POS: [number, number, number] = [-0.100220, 0.237780, 0.003956]
const R_SHOULDER_PITCH_POS: [number, number, number] = [0.100210, 0.237780, 0.003956]
// 左臂链（嵌套 origin）
const L_SHOULDER_ROLL_POS: [number, number, number] = [-0.038000, -0.013831, 0.000000]
const L_SHOULDER_YAW_POS: [number, number, number] = [-0.006240, -0.103200, 0.000000]
const L_ELBOW_POS: [number, number, number] = [0.000000, -0.080518, 0.015783]
const L_WRIST_ROLL_POS: [number, number, number] = [-0.001888, -0.010000, 0.100000]
const L_WRIST_PITCH_POS: [number, number, number] = [0.000000, 0.000000, 0.038000]
const L_WRIST_YAW_POS: [number, number, number] = [0.000000, 0.000000, 0.046000]

// 右臂链
const R_SHOULDER_ROLL_POS: [number, number, number] = [0.038000, -0.013831, 0.000000]
const R_SHOULDER_YAW_POS: [number, number, number] = [0.006240, -0.103200, 0.000000]
const R_ELBOW_POS: [number, number, number] = [0.000000, -0.080518, 0.015783]
const R_WRIST_ROLL_POS: [number, number, number] = [0.001888, -0.010000, 0.100000]
const R_WRIST_PITCH_POS: [number, number, number] = [0.000000, 0.000000, 0.038000]
const R_WRIST_YAW_POS: [number, number, number] = [0.000000, 0.000000, 0.046000]

// 左腿链（相对 pelvis）
const L_HIP_PITCH_POS: [number, number, number] = [-0.064452, -0.102700, 0.000000]
const L_HIP_ROLL_POS: [number, number, number] = [-0.052000, -0.030465, 0.000000]
const L_HIP_YAW_POS: [number, number, number] = [0.000000, -0.124120, 0.025001]
const L_KNEE_POS: [number, number, number] = [-0.002149, -0.177340, -0.078273]
const L_ANKLE_PITCH_POS: [number, number, number] = [0.000094, -0.300010, 0.000000]
const L_ANKLE_ROLL_POS: [number, number, number] = [0.000000, -0.017558, 0.000000]

// 右腿链
const R_HIP_PITCH_POS: [number, number, number] = [0.064452, -0.102700, 0.000000]
const R_HIP_ROLL_POS: [number, number, number] = [0.052000, -0.030465, 0.000000]
const R_HIP_YAW_POS: [number, number, number] = [0.000000, -0.124120, 0.025001]
const R_KNEE_POS: [number, number, number] = [0.002149, -0.177340, -0.078273]
const R_ANKLE_PITCH_POS: [number, number, number] = [-0.000094, -0.300010, 0.000000]
const R_ANKLE_ROLL_POS: [number, number, number] = [0.000000, -0.017558, 0.000000]

// ─── LIFT 计算 ─────────────────────────────────────────
// v3: 腰部链偏移 PELVIS_H（从骨盆底部 → 骨盆顶部）
// 腿部累计 Y 偏移 = -(0.1027 + 0.030465 + 0.12412 + 0.17734 + 0.30001 + 0.017558) = -0.752m
// 脚底相对于踝关节的偏移 = 0.01 (sole position) + 0.0075 (half sole height) = 0.0175m
// 实测 feet Y ≈ 0.008 (LIFT=0.770)，微调 -0.008 到 LIFT=0.762
// 让脚底对齐地面 (y=0)
const LIFT = 0.762

// ─── JOINT_AXIS_OVERRIDE（单一事实来源：URDF <axis> 标签） ───
// URDF axis (1,0,0) → Three.js axis="x"（roll 类，绕 X 轴旋转）
// URDF axis (0,1,0) → Three.js axis="z"（pitch 类，绕 Z 轴旋转）
// URDF axis (0,0,1) → Three.js axis="y"（yaw 类，绕 Y 轴旋转）
export const JOINT_AXIS_OVERRIDE: Record<string, 'x' | 'y' | 'z'> = {
  // 腰部
  'waist_yaw_joint': 'y',       // URDF (0,0,1) → yaw
  'waist_roll_joint': 'x',      // URDF (1,0,0) → roll
  'waist_pitch_joint': 'z',     // URDF (0,1,0) → pitch
  // 左腿
  'left_hip_pitch_joint': 'z',  // URDF (0,1,0) → pitch
  'left_hip_roll_joint': 'x',   // URDF (1,0,0) → roll
  'left_hip_yaw_joint': 'y',    // URDF (0,0,1) → yaw
  'left_knee_joint': 'z',       // URDF (0,1,0) → pitch
  'left_ankle_pitch_joint': 'z',// URDF (0,1,0) → pitch
  'left_ankle_roll_joint': 'x', // URDF (1,0,0) → roll
  // 右腿
  'right_hip_pitch_joint': 'z',
  'right_hip_roll_joint': 'x',
  'right_hip_yaw_joint': 'y',
  'right_knee_joint': 'z',
  'right_ankle_pitch_joint': 'z',
  'right_ankle_roll_joint': 'x',
  // 左臂
  'left_shoulder_pitch_joint': 'z',
  'left_shoulder_roll_joint': 'x',
  'left_shoulder_yaw_joint': 'y',
  'left_elbow_joint': 'z',
  'left_wrist_roll_joint': 'x',
  'left_wrist_pitch_joint': 'z',
  'left_wrist_yaw_joint': 'y',
  // 右臂
  'right_shoulder_pitch_joint': 'z',
  'right_shoulder_roll_joint': 'x',
  'right_shoulder_yaw_joint': 'y',
  'right_elbow_joint': 'z',
  'right_wrist_roll_joint': 'x',
  'right_wrist_pitch_joint': 'z',
  'right_wrist_yaw_joint': 'y',
}

// ─── JOINT_LIMITS（URDF <limit> 标签，弧度制） ────────────
export const JOINT_LIMITS: Record<string, { lower: number; upper: number }> = {
  'waist_yaw_joint': { lower: -2.618, upper: 2.618 },
  'waist_roll_joint': { lower: -0.52, upper: 0.52 },
  'waist_pitch_joint': { lower: -0.52, upper: 0.52 },
  'left_hip_pitch_joint': { lower: -2.5307, upper: 2.8798 },
  'left_hip_roll_joint': { lower: -0.5236, upper: 2.9671 },
  'left_hip_yaw_joint': { lower: -2.7576, upper: 2.7576 },
  'left_knee_joint': { lower: -0.087267, upper: 2.8798 },
  'left_ankle_pitch_joint': { lower: -0.87267, upper: 0.5236 },
  'left_ankle_roll_joint': { lower: -0.2618, upper: 0.2618 },
  'right_hip_pitch_joint': { lower: -2.5307, upper: 2.8798 },
  'right_hip_roll_joint': { lower: -2.9671, upper: 0.5236 },
  'right_hip_yaw_joint': { lower: -2.7576, upper: 2.7576 },
  'right_knee_joint': { lower: -0.087267, upper: 2.8798 },
  'right_ankle_pitch_joint': { lower: -0.87267, upper: 0.5236 },
  'right_ankle_roll_joint': { lower: -0.2618, upper: 0.2618 },
  'left_shoulder_pitch_joint': { lower: -3.0892, upper: 2.6704 },
  'left_shoulder_roll_joint': { lower: -1.5882, upper: 2.2515 },
  'left_shoulder_yaw_joint': { lower: -2.618, upper: 2.618 },
  'left_elbow_joint': { lower: -1.0472, upper: 2.0944 },
  'left_wrist_roll_joint': { lower: -1.9722, upper: 1.9722 },
  'left_wrist_pitch_joint': { lower: -1.6144, upper: 1.6144 },
  'left_wrist_yaw_joint': { lower: -1.6144, upper: 1.6144 },
  'right_shoulder_pitch_joint': { lower: -3.0892, upper: 2.6704 },
  'right_shoulder_roll_joint': { lower: -2.2515, upper: 1.5882 },
  'right_shoulder_yaw_joint': { lower: -2.618, upper: 2.618 },
  'right_elbow_joint': { lower: -1.0472, upper: 2.0944 },
  'right_wrist_roll_joint': { lower: -1.9722, upper: 1.9722 },
  'right_wrist_pitch_joint': { lower: -1.6144, upper: 1.6144 },
  'right_wrist_yaw_joint': { lower: -1.6144, upper: 1.6144 },
}

// ─── 辅助：读取关节角度（带限位钳制） ──────────────────
function getAngle(
  joints: Record<string, number> | undefined,
  key: string,
): number | undefined {
  if (!joints) return undefined
  const v = joints[key]
  if (v === undefined) return undefined
  // 2026-08-28: 按 URDF <limit> 钳制关节角，防止超限
  const lim = JOINT_LIMITS[key]
  if (lim) {
    return Math.max(lim.lower, Math.min(lim.upper, v))
  }
  return v
}

// ─── 辅助：获取关节轴（从 JOINT_AXIS_OVERRIDE） ─────────
function getAxis(key: string): 'x' | 'y' | 'z' {
  return JOINT_AXIS_OVERRIDE[key] ?? 'z'
}

// ─── v3 新组件：显式 position 累积的连杆构建 ────────────

/**
 * 连杆视觉组件：在关节原点与子关节之间画一根对齐的圆柱
 * 纯视觉组件，不承担位置传递职责
 */
function LinkVisual({
  offset,
  thickness,
  color,
  metalness = 0.45,
  roughness = 0.4,
}: {
  offset: [number, number, number]
  thickness: number
  color: string
  metalness?: number
  roughness?: number
}) {
  const [dx, dy, dz] = offset
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)

  const quat = useMemo(() => {
    if (len < 0.0001) return new THREE.Quaternion()
    const dir = new THREE.Vector3(dx, dy, dz).normalize()
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir,
    )
  }, [dx, dy, dz, len])

  if (len < 0.0001) return null

  return (
    <mesh castShadow position={[dx / 2, dy / 2, dz / 2]} quaternion={quat}>
      <cylinderGeometry args={[thickness * 0.85, thickness, len, 16]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  )
}

/**
 * 关节球视觉组件
 */
function JointBallVisual({
  radius,
  color,
  healthPct,
}: {
  radius: number
  color: string
  healthPct?: number
}) {
  const finalColor = healthPct !== undefined
    ? healthPct > 80 ? color : healthPct > 50 ? '#ffcc00' : '#ff3d71'
    : color

  return (
    <mesh castShadow position={[0, 0, 0]}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={finalColor}
        metalness={0.5}
        roughness={0.4}
        emissive={finalColor}
        emissiveIntensity={0.15}
      />
    </mesh>
  )
}

// ─── 手臂链（肩→肘→腕→手，v3 显式 position 累积） ──────
function ArmChain({
  side,
  shoulderPitch,
  shoulderRoll,
  shoulderYaw,
  elbow,
  wristRoll,
  wristPitch,
  wristYaw,
}: {
  side: 'left' | 'right'
  shoulderPitch?: number
  shoulderRoll?: number
  shoulderYaw?: number
  elbow?: number
  wristRoll?: number
  wristPitch?: number
  wristYaw?: number
}) {
  const isLeft = side === 'left'

  const sp = isLeft ? L_SHOULDER_PITCH_POS : R_SHOULDER_PITCH_POS
  const sr = isLeft ? L_SHOULDER_ROLL_POS : R_SHOULDER_ROLL_POS
  const sy = isLeft ? L_SHOULDER_YAW_POS : R_SHOULDER_YAW_POS
  const el = isLeft ? L_ELBOW_POS : R_ELBOW_POS
  const wr = isLeft ? L_WRIST_ROLL_POS : R_WRIST_ROLL_POS
  const wp = isLeft ? L_WRIST_PITCH_POS : R_WRIST_PITCH_POS
  const wy = isLeft ? L_WRIST_YAW_POS : R_WRIST_YAW_POS

  const spKey = isLeft ? 'left_shoulder_pitch_joint' : 'right_shoulder_pitch_joint'
  const srKey = isLeft ? 'left_shoulder_roll_joint' : 'right_shoulder_roll_joint'
  const syKey = isLeft ? 'left_shoulder_yaw_joint' : 'right_shoulder_yaw_joint'
  const elKey = isLeft ? 'left_elbow_joint' : 'right_elbow_joint'
  const wrKey = isLeft ? 'left_wrist_roll_joint' : 'right_wrist_roll_joint'
  const wpKey = isLeft ? 'left_wrist_pitch_joint' : 'right_wrist_pitch_joint'
  const wyKey = isLeft ? 'left_wrist_yaw_joint' : 'right_wrist_yaw_joint'

  // v3：每级用 <group position={offset}> + <JointPivot> + <link> + <group position={nextOffset}>
  // 确保 position 链显式累积，不依赖 quaternion 嵌套传递

  return (
    // 肩关节 Pitch：相对 torso 的 origin
    <group position={sp}>
      <JointBallVisual radius={JOINT_R_SHOULDER} color={METAL_COLOR} />
      <JointPivot targetAngle={shoulderPitch} axis={getAxis(spKey)} speed={8}>
        {/* 肩 Pitch → Roll 的连杆 */}
        <LinkVisual offset={sr} thickness={ARM_THICK} color={METAL_COLOR} />
        {/* 肩关节 Roll：相对 shoulder_pitch_link 的 origin */}
        <group position={sr}>
          <JointBallVisual radius={JOINT_R_SHOULDER * 0.9} color={METAL_COLOR} />
          <JointPivot targetAngle={shoulderRoll} axis={getAxis(srKey)} speed={8}>
            {/* 肩 Roll → Yaw 的连杆 */}
            <LinkVisual offset={sy} thickness={ARM_THICK} color={METAL_COLOR} />
            {/* 肩关节 Yaw */}
            <group position={sy}>
              <JointBallVisual radius={JOINT_R_SHOULDER * 0.8} color={METAL_COLOR} />
              <JointPivot targetAngle={shoulderYaw} axis={getAxis(syKey)} speed={8}>
                {/* 肩 Yaw → 肘 的连杆 */}
                <LinkVisual offset={el} thickness={ARM_THICK} color={METAL_COLOR} />
                {/* 肘关节 */}
                <group position={el}>
                  <JointBallVisual radius={JOINT_R_ELBOW} color={METAL_COLOR} />
                  <JointPivot targetAngle={elbow} axis={getAxis(elKey)} speed={8}>
                    {/* 肘 → 腕 Roll 的连杆 */}
                    <LinkVisual offset={wr} thickness={FOREARM_THICK} color={METAL_COLOR} />
                    {/* 腕 Roll */}
                    <group position={wr}>
                      <JointBallVisual radius={JOINT_R_WRIST} color={DARK_COLOR} />
                      <JointPivot targetAngle={wristRoll} axis={getAxis(wrKey)} speed={8}>
                        {/* 腕 Roll → Pitch 的连杆 */}
                        <LinkVisual offset={wp} thickness={FOREARM_THICK} color={DARK_COLOR} />
                        {/* 腕 Pitch */}
                        <group position={wp}>
                          <JointBallVisual radius={JOINT_R_WRIST * 0.9} color={DARK_COLOR} />
                          <JointPivot targetAngle={wristPitch} axis={getAxis(wpKey)} speed={8}>
                            {/* 腕 Pitch → Yaw 的连杆 */}
                            <LinkVisual offset={wy} thickness={0.015} color={DARK_COLOR} />
                            {/* 腕 Yaw → 手掌 */}
                            <group position={wy}>
                              <JointBallVisual radius={JOINT_R_WRIST * 0.8} color={DARK_COLOR} />
                              <JointPivot targetAngle={wristYaw} axis={getAxis(wyKey)} speed={8}>
                                {/* 手掌 */}
                                <mesh castShadow position={[0, 0.04, 0]}>
                                  <boxGeometry args={[0.06, 0.08, 0.03]} />
                                  <meshStandardMaterial color={DARK_COLOR} metalness={0.3} roughness={0.5} />
                                </mesh>
                                {/* 手指 */}
                                {[0, 1, 2, 3].map((i) => (
                                  <mesh
                                    key={i}
                                    castShadow
                                    position={[-0.02 + i * 0.014, 0.09, 0]}
                                  >
                                    <cylinderGeometry args={[0.004, 0.004, 0.04, 8]} />
                                    <meshStandardMaterial color={DARK_COLOR} metalness={0.2} roughness={0.6} />
                                  </mesh>
                                ))}
                              </JointPivot>
                            </group>
                          </JointPivot>
                        </group>
                      </JointPivot>
                    </group>
                  </JointPivot>
                </group>
              </JointPivot>
            </group>
          </JointPivot>
        </group>
      </JointPivot>
    </group>
  )
}

// ─── 腿部链（髋→膝→踝→脚，v3 显式 position 累积） ──────
function LegChain({
  side,
  hipPitch,
  hipRoll,
  hipYaw,
  knee,
  anklePitch,
  ankleRoll,
}: {
  side: 'left' | 'right'
  hipPitch?: number
  hipRoll?: number
  hipYaw?: number
  knee?: number
  anklePitch?: number
  ankleRoll?: number
}) {
  const isLeft = side === 'left'

  const hp = isLeft ? L_HIP_PITCH_POS : R_HIP_PITCH_POS
  const hr = isLeft ? L_HIP_ROLL_POS : R_HIP_ROLL_POS
  const hy = isLeft ? L_HIP_YAW_POS : R_HIP_YAW_POS
  const kn = isLeft ? L_KNEE_POS : R_KNEE_POS
  const ap = isLeft ? L_ANKLE_PITCH_POS : R_ANKLE_PITCH_POS
  const ar = isLeft ? L_ANKLE_ROLL_POS : R_ANKLE_ROLL_POS

  const hpKey = isLeft ? 'left_hip_pitch_joint' : 'right_hip_pitch_joint'
  const hrKey = isLeft ? 'left_hip_roll_joint' : 'right_hip_roll_joint'
  const hyKey = isLeft ? 'left_hip_yaw_joint' : 'right_hip_yaw_joint'
  const knKey = isLeft ? 'left_knee_joint' : 'right_knee_joint'
  const apKey = isLeft ? 'left_ankle_pitch_joint' : 'right_ankle_pitch_joint'
  const arKey = isLeft ? 'left_ankle_roll_joint' : 'right_ankle_roll_joint'

  return (
    // 髋 Pitch：相对 pelvis 的 origin
    <group position={hp}>
      <JointBallVisual radius={JOINT_R_HIP} color={METAL_COLOR} />
      <JointPivot targetAngle={hipPitch} axis={getAxis(hpKey)} speed={8}>
        {/* 髋 Pitch → Roll 的连杆 */}
        <LinkVisual offset={hr} thickness={LEG_THICK} color={METAL_COLOR} />
        {/* 髋 Roll */}
        <group position={hr}>
          <JointBallVisual radius={JOINT_R_HIP * 0.9} color={METAL_COLOR} />
          <JointPivot targetAngle={hipRoll} axis={getAxis(hrKey)} speed={8}>
            {/* 髋 Roll → Yaw 的连杆 */}
            <LinkVisual offset={hy} thickness={LEG_THICK} color={METAL_COLOR} />
            {/* 髋 Yaw */}
            <group position={hy}>
              <JointBallVisual radius={JOINT_R_HIP * 0.8} color={METAL_COLOR} />
              <JointPivot targetAngle={hipYaw} axis={getAxis(hyKey)} speed={8}>
                {/* 髋 Yaw → 膝 的连杆 */}
                <LinkVisual offset={kn} thickness={LEG_THICK} color={METAL_COLOR} />
                {/* 膝 */}
                <group position={kn}>
                  <JointBallVisual radius={JOINT_R_KNEE} color={METAL_COLOR} />
                  <JointPivot targetAngle={knee} axis={getAxis(knKey)} speed={8}>
                    {/* 膝 → 踝 Pitch 的连杆 */}
                    <LinkVisual offset={ap} thickness={CALF_THICK} color={DARK_COLOR} />
                    {/* 踝 Pitch */}
                    <group position={ap}>
                      <JointBallVisual radius={JOINT_R_ANKLE} color={DARK_COLOR} />
                      <JointPivot targetAngle={anklePitch} axis={getAxis(apKey)} speed={8}>
                        {/* 踝 Pitch → Roll 的连杆 */}
                        <LinkVisual offset={ar} thickness={CALF_THICK * 0.7} color={DARK_COLOR} />
                        {/* 踝 Roll → 脚掌 */}
                        <group position={ar}>
                          <JointBallVisual radius={JOINT_R_ANKLE * 0.8} color={DARK_COLOR} />
                          <JointPivot targetAngle={ankleRoll} axis={getAxis(arKey)} speed={8}>
                            {/* 脚掌 */}
                            <mesh castShadow position={[0, -0.01, 0.04]}>
                              <boxGeometry args={[0.08, 0.015, 0.14]} />
                              <meshStandardMaterial color={DARK_COLOR} metalness={0.3} roughness={0.6} />
                            </mesh>
                            {/* 脚趾 */}
                            <mesh castShadow position={[0, -0.005, 0.08]}>
                              <boxGeometry args={[0.07, 0.01, 0.04]} />
                              <meshStandardMaterial color={DARK_COLOR} metalness={0.2} roughness={0.7} />
                            </mesh>
                          </JointPivot>
                        </group>
                      </JointPivot>
                    </group>
                  </JointPivot>
                </group>
              </JointPivot>
            </group>
          </JointPivot>
        </group>
      </JointPivot>
    </group>
  )
}

// ─── 主组件 ────────────────────────────────────────────
export function G1Humanoid({ position, rotation, joints, scale = 1.0 }: G1HumanoidProps) {
  const j = useMemo(() => joints ?? {}, [joints])
  const rootRef = useRef<THREE.Group>(null)

  // L1 几何校验：Box3 测量机器人尺寸
  // 验证 G1 身高 = 1.30m ±0.05m，肩宽 = 0.42m ±0.02m
  const l1MeasuredRef = useRef(false)
  useFrame(() => {
    if (l1MeasuredRef.current || !rootRef.current) return
    l1MeasuredRef.current = true
    const box = new THREE.Box3().setFromObject(rootRef.current)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    // 肩宽测量：遍历 mesh 找出肩部高度范围（约 1.05-1.20m）内的 X 极值
    // 肩关节 X 坐标 ≈ ±0.100m → 肩宽 ≈ 0.200m，但全臂展 ≈ 0.42m
    let shoulderMinX = Infinity
    let shoulderMaxX = -Infinity
    let shoulderMeshCount = 0
    rootRef.current.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const wp = new THREE.Vector3()
        obj.getWorldPosition(wp)
        // 肩部 Y 范围（从肩 pitch 到肩 yaw 区域）
        if (wp.y > 1.0 && wp.y < 1.25) {
          if (wp.x < shoulderMinX) shoulderMinX = wp.x
          if (wp.x > shoulderMaxX) shoulderMaxX = wp.x
          shoulderMeshCount++
        }
      }
    })
    const shoulderWidth = shoulderMaxX - shoulderMinX
    const heightOk = Math.abs(size.y - 1.30) < 0.05
    const shoulderOk = Math.abs(shoulderWidth - 0.42) < 0.02

    console.table({
      '身高实测(m)': Number(size.y.toFixed(3)),
      '身高期望(m)': 1.30,
      '身高校验': heightOk ? '✅ PASS' : '❌ FAIL',
      '肩宽实测(m)': Number(shoulderWidth.toFixed(3)),
      '肩宽期望(m)': 0.42,
      '肩宽校验': shoulderOk ? '✅ PASS' : '❌ FAIL',
      '深度(m)': Number(size.z.toFixed(3)),
      '脚底Y': Number(box.min.y.toFixed(3)),
      '头顶Y': Number(box.max.y.toFixed(3)),
    })

    // 详细 mesh 位置诊断
    let minMeshY = Infinity
    let maxMeshY = -Infinity
    const positions: string[] = []
    const groupPositions: string[] = []
    rootRef.current.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const wp = new THREE.Vector3()
        obj.getWorldPosition(wp)
        const localPos = obj.position
        positions.push(`y=${wp.y.toFixed(3)} local=[${localPos.x.toFixed(3)},${localPos.y.toFixed(3)},${localPos.z.toFixed(3)}]`)
        if (wp.y < minMeshY) minMeshY = wp.y
        if (wp.y > maxMeshY) maxMeshY = wp.y
      } else if ((obj as THREE.Group).isGroup) {
        const wp = new THREE.Vector3()
        obj.getWorldPosition(wp)
        groupPositions.push(`${wp.y.toFixed(3)}`)
      }
    })
    console.log('[g1-l1] Mesh Y范围:', `min=${minMeshY.toFixed(3)}`, `max=${maxMeshY.toFixed(3)}`)
    console.log('[g1-l1] Group Y分布 (所有):', groupPositions.sort().join(', '))
    console.log('[g1-l1] Mesh 总数:', positions.length)

    if (!heightOk || !shoulderOk) {
      console.warn('[g1-l1] ⚠️ 等比例校验未通过，请检查！')
    }
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group ref={rootRef} position={[0, LIFT, 0]}>
        {/* 骨盆 */}
        <mesh castShadow position={[0, PELVIS_H / 2, 0]}>
          <boxGeometry args={[PELVIS_W, PELVIS_H, PELVIS_D]} />
          <meshStandardMaterial color={BODY_COLOR} metalness={0.5} roughness={0.35} />
        </mesh>

        {/* v3 腰部：偏移 PELVIS_H 到骨盆顶部（URDF waist_yaw_joint 接 base_link 顶部） */}
        <group position={[0, PELVIS_H, 0]}>
          <JointPivot targetAngle={getAngle(j, 'waist_yaw_joint')} axis={getAxis('waist_yaw_joint')} speed={8}>
            {/* waist_yaw_link 几何 */}
            <mesh castShadow position={[0, -0.0175, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 0.035, 16]} />
              <meshStandardMaterial color={METAL_COLOR} metalness={0.5} roughness={0.4} />
            </mesh>

            {/* waist_roll 关节：相对 waist_yaw_link 的 origin */}
            <group position={WAIST_ROLL_POS}>
              <JointBallVisual radius={0.04} color={METAL_COLOR} />
              <JointPivot targetAngle={getAngle(j, 'waist_roll_joint')} axis={getAxis('waist_roll_joint')} speed={8}>
                {/* waist_roll_link 几何 */}
                <mesh castShadow position={[0, -0.0095, 0]}>
                  <cylinderGeometry args={[0.035, 0.04, 0.019, 16]} />
                  <meshStandardMaterial color={METAL_COLOR} metalness={0.5} roughness={0.4} />
                </mesh>

                {/* waist_pitch 关节：相对 waist_roll_link 的 origin */}
                <group position={WAIST_PITCH_POS}>
                  <JointBallVisual radius={0.04} color={METAL_COLOR} />
                  <JointPivot targetAngle={getAngle(j, 'waist_pitch_joint')} axis={getAxis('waist_pitch_joint')} speed={8}>
                    {/* 躯干 */}
                    <mesh castShadow position={[0, TORSO_H / 2, 0]}>
                      <boxGeometry args={[TORSO_W, TORSO_H, TORSO_D]} />
                      <meshStandardMaterial color={BODY_COLOR} metalness={0.5} roughness={0.35} />
                    </mesh>
                    {/* 腰部灯带 */}
                    <mesh position={[0, 0.02, TORSO_D / 2 + 0.003]}>
                      <boxGeometry args={[TORSO_W - 0.02, 0.015, 0.005]} />
                      <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.8} />
                    </mesh>

                    {/* 头部（URDF 中为 fixed joint，无旋转） */}
                    {/* head_joint origin 相对 torso_link: (0.0039635, 0, -0.054) → Three.js: (0, -0.054, 0.004) */}
                    {/* head_link 惯性中心 Z≈0.45，所以头部实际位置在 torso 上方约 0.396m */}
                    <mesh castShadow position={[0, 0.396, 0]}>
                      <sphereGeometry args={[HEAD_R, 20, 20]} />
                      <meshStandardMaterial
                        color={DARK_COLOR}
                        metalness={0.6}
                        roughness={0.3}
                        emissive={ACCENT}
                        emissiveIntensity={0.3}
                      />
                    </mesh>
                    {/* 面部传感器 */}
                    <mesh position={[0, 0.396, HEAD_R - 0.005]}>
                      <sphereGeometry args={[0.025, 12, 12]} />
                      <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1} />
                    </mesh>

                    {/* 左臂链 */}
                    <ArmChain
                      side="left"
                      shoulderPitch={getAngle(j, 'left_shoulder_pitch_joint')}
                      shoulderRoll={getAngle(j, 'left_shoulder_roll_joint')}
                      shoulderYaw={getAngle(j, 'left_shoulder_yaw_joint')}
                      elbow={getAngle(j, 'left_elbow_joint')}
                      wristRoll={getAngle(j, 'left_wrist_roll_joint')}
                      wristPitch={getAngle(j, 'left_wrist_pitch_joint')}
                      wristYaw={getAngle(j, 'left_wrist_yaw_joint')}
                    />
                    {/* 右臂链 */}
                    <ArmChain
                      side="right"
                      shoulderPitch={getAngle(j, 'right_shoulder_pitch_joint')}
                      shoulderRoll={getAngle(j, 'right_shoulder_roll_joint')}
                      shoulderYaw={getAngle(j, 'right_shoulder_yaw_joint')}
                      elbow={getAngle(j, 'right_elbow_joint')}
                      wristRoll={getAngle(j, 'right_wrist_roll_joint')}
                      wristPitch={getAngle(j, 'right_wrist_pitch_joint')}
                      wristYaw={getAngle(j, 'right_wrist_yaw_joint')}
                    />
                  </JointPivot>
                </group>
              </JointPivot>
            </group>
          </JointPivot>
        </group>

        {/* 左腿链 */}
        <LegChain
          side="left"
          hipPitch={getAngle(j, 'left_hip_pitch_joint')}
          hipRoll={getAngle(j, 'left_hip_roll_joint')}
          hipYaw={getAngle(j, 'left_hip_yaw_joint')}
          knee={getAngle(j, 'left_knee_joint')}
          anklePitch={getAngle(j, 'left_ankle_pitch_joint')}
          ankleRoll={getAngle(j, 'left_ankle_roll_joint')}
        />
        {/* 右腿链 */}
        <LegChain
          side="right"
          hipPitch={getAngle(j, 'right_hip_pitch_joint')}
          hipRoll={getAngle(j, 'right_hip_roll_joint')}
          hipYaw={getAngle(j, 'right_hip_yaw_joint')}
          knee={getAngle(j, 'right_knee_joint')}
          anklePitch={getAngle(j, 'right_ankle_pitch_joint')}
          ankleRoll={getAngle(j, 'right_ankle_roll_joint')}
        />
      </group>
    </group>
  )
}
