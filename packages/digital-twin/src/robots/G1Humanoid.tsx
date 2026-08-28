/**
 * G1Humanoid.tsx
 * 宇树 G1 29 DOF 人形机器人 — URDF 等比例还原版
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
 * 坐标转换：three.js(x, y, z) = urdf(x, -z, y)
 *
 * 29 DOF = 腰部3 + 双臂14 + 双腿12
 */
import { useMemo } from 'react'
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
// const JOINT_R_WAIST = 0.05 // 预留：腰部关节球半径

// ─── 连杆厚度 ──────────────────────────────────────────
const ARM_THICK = 0.025
const FOREARM_THICK = 0.022
const LEG_THICK = 0.035
const CALF_THICK = 0.030

// ─── URDF 真实关节 origin（Three.js Y-up 坐标，单位米） ───
// 转换公式：three(x, y, z) = urdf(x, -z, y)

// ─── 腰部链（相对 pelvis） ── waist_yaw 位于 pelvis 原点 [0,0,0]
const WAIST_ROLL_POS: [number, number, number] = [-0.0039635, -0.035, 0]
const WAIST_PITCH_POS: [number, number, number] = [0, -0.019, 0]

// 躯干 frame 下的关节 origin
const L_SHOULDER_PITCH_POS: [number, number, number] = [0.0039563, -0.23778, 0.10022]
const R_SHOULDER_PITCH_POS: [number, number, number] = [0.0039563, -0.23778, -0.10021]
const HEAD_FIXED_POS: [number, number, number] = [0.0039635, 0.054, 0]

// 左臂链（嵌套 origin）
const L_SHOULDER_ROLL_POS: [number, number, number] = [0, 0.013831, 0.038]
const L_SHOULDER_YAW_POS: [number, number, number] = [0, 0.1032, 0.00624]
const L_ELBOW_POS: [number, number, number] = [0.015783, 0.080518, 0]
const L_WRIST_ROLL_POS: [number, number, number] = [0.100, 0.010, 0.00188791]
const L_WRIST_PITCH_POS: [number, number, number] = [0.038, 0, 0]
const L_WRIST_YAW_POS: [number, number, number] = [0.046, 0, 0]

// 右臂链
const R_SHOULDER_ROLL_POS: [number, number, number] = [0, 0.013831, -0.038]
const R_SHOULDER_YAW_POS: [number, number, number] = [0, 0.1032, -0.00624]
const R_ELBOW_POS: [number, number, number] = [0.015783, 0.080518, 0]
const R_WRIST_ROLL_POS: [number, number, number] = [0.100, 0.010, -0.00188791]
const R_WRIST_PITCH_POS: [number, number, number] = [0.038, 0, 0]
const R_WRIST_YAW_POS: [number, number, number] = [0.046, 0, 0]

// 左腿链（相对 pelvis）
const L_HIP_PITCH_POS: [number, number, number] = [0, 0.1027, 0.064452]
const L_HIP_ROLL_POS: [number, number, number] = [0, 0.030465, 0.052]
const L_HIP_YAW_POS: [number, number, number] = [0.025001, 0.12412, 0]
const L_KNEE_POS: [number, number, number] = [-0.078273, 0.17734, 0.0021489]
const L_ANKLE_PITCH_POS: [number, number, number] = [0, 0.30001, -0.000094445]
const L_ANKLE_ROLL_POS: [number, number, number] = [0, 0.017558, 0]

// 右腿链
const R_HIP_PITCH_POS: [number, number, number] = [0, 0.1027, -0.064452]
const R_HIP_ROLL_POS: [number, number, number] = [0, 0.030465, -0.052]
const R_HIP_YAW_POS: [number, number, number] = [0.025001, 0.12412, 0]
const R_KNEE_POS: [number, number, number] = [-0.078273, 0.17734, -0.0021489]
const R_ANKLE_PITCH_POS: [number, number, number] = [0, 0.30001, 0.000094445]
const R_ANKLE_ROLL_POS: [number, number, number] = [0, 0.017558, 0]

// 脚部抬升偏移：让脚底对齐地面（y=0）
// 从 pelvis 中心到 ankle_roll 总下降距离 ≈ 0.752m + 脚掌厚度 0.02m - PELVIS_H/2
const LIFT = 0.712

// ─── 辅助：读取关节角度（兼容 undefined） ──────────────
function getAngle(joints: Record<string, number> | undefined, key: string): number | undefined {
  if (!joints) return undefined
  const v = joints[key]
  return v !== undefined ? v : undefined
}

// ─── 3D 连杆网格：从 (0,0,0) 延伸到目标偏移位置 ──────
function LinkToNext({
  offset,
  thickness,
  color,
  metalness = 0.45,
  roughness = 0.4,
  children,
}: {
  offset: [number, number, number]
  thickness: number
  color: string
  metalness?: number
  roughness?: number
  children?: React.ReactNode
}) {
  const [dx, dy, dz] = offset
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)

  // 计算从 (0,1,0) 到目标方向的旋转四元数
  const quat = useMemo(() => {
    if (len < 0.0001) return new THREE.Quaternion()
    const dir = new THREE.Vector3(dx, dy, dz).normalize()
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir,
    )
  }, [dx, dy, dz, len])

  return (
    <group position={[dx / 2, dy / 2, dz / 2]} quaternion={quat}>
      <mesh castShadow>
        <cylinderGeometry args={[thickness * 0.85, thickness, len, 16]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
      </mesh>
      {children}
    </group>
  )
}

// ─── 单段连杆（球+杆 组合，兼容健康分变色） ────────────
function JointSegment({
  offset,
  thickness,
  color,
  jointRadius,
  healthPct,
  children,
}: {
  offset: [number, number, number]
  thickness: number
  color: string
  jointRadius: number
  healthPct?: number
  children?: React.ReactNode
}) {
  const finalColor = healthPct !== undefined
    ? healthPct > 80 ? color : healthPct > 50 ? '#ffcc00' : '#ff3d71'
    : color

  return (
    <>
      {/* 关节球 */}
      <mesh castShadow position={[0, 0, 0]}>
        <sphereGeometry args={[jointRadius, 16, 16]} />
        <meshStandardMaterial
          color={finalColor}
          metalness={0.5}
          roughness={0.4}
          emissive={finalColor}
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* 连杆：从关节原点延伸到下一个关节 */}
      <LinkToNext offset={offset} thickness={thickness} color={color}>
        {children}
      </LinkToNext>
    </>
  )
}

// ─── 手臂链（肩→肘→腕→手，URDF 精确嵌套） ──────────────
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

  // 根据侧别选择坐标
  const sp = isLeft ? L_SHOULDER_PITCH_POS : R_SHOULDER_PITCH_POS
  const sr = isLeft ? L_SHOULDER_ROLL_POS : R_SHOULDER_ROLL_POS
  const sy = isLeft ? L_SHOULDER_YAW_POS : R_SHOULDER_YAW_POS
  const el = isLeft ? L_ELBOW_POS : R_ELBOW_POS
  const wr = isLeft ? L_WRIST_ROLL_POS : R_WRIST_ROLL_POS
  const wp = isLeft ? L_WRIST_PITCH_POS : R_WRIST_PITCH_POS
  const wy = isLeft ? L_WRIST_YAW_POS : R_WRIST_YAW_POS

  return (
    <group position={sp}>
      {/* 肩关节 Pitch（绕 Z） */}
      <JointPivot targetAngle={shoulderPitch} axis="z" speed={8}>
        <JointSegment
          offset={sr}
          thickness={ARM_THICK}
          color={METAL_COLOR}
          jointRadius={JOINT_R_SHOULDER}
        >
          {/* 肩关节 Roll（绕 X） */}
          <JointPivot targetAngle={shoulderRoll} axis="x" speed={8}>
            <JointSegment
              offset={sy}
              thickness={ARM_THICK}
              color={METAL_COLOR}
              jointRadius={JOINT_R_SHOULDER * 0.9}
            >
              {/* 肩关节 Yaw（绕 Y） */}
              <JointPivot targetAngle={shoulderYaw} axis="y" speed={8}>
                <JointSegment
                  offset={el}
                  thickness={ARM_THICK}
                  color={METAL_COLOR}
                  jointRadius={JOINT_R_SHOULDER * 0.8}
                >
                  {/* 肘关节（绕 Z） */}
                  <JointPivot targetAngle={elbow} axis="z" speed={8}>
                    <JointSegment
                      offset={wr}
                      thickness={FOREARM_THICK}
                      color={METAL_COLOR}
                      jointRadius={JOINT_R_ELBOW}
                    >
                      {/* 腕 Roll（绕 X） */}
                      <JointPivot targetAngle={wristRoll} axis="x" speed={8}>
                        <JointSegment
                          offset={wp}
                          thickness={FOREARM_THICK}
                          color={DARK_COLOR}
                          jointRadius={JOINT_R_WRIST}
                        >
                          {/* 腕 Pitch（绕 Z） */}
                          <JointPivot targetAngle={wristPitch} axis="z" speed={8}>
                            <JointSegment
                              offset={wy}
                              thickness={0.015}
                              color={DARK_COLOR}
                              jointRadius={JOINT_R_WRIST * 0.8}
                            >
                              {/* 腕 Yaw（绕 Y） → 手掌 */}
                              <JointPivot targetAngle={wristYaw} axis="y" speed={8}>
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
                            </JointSegment>
                          </JointPivot>
                        </JointSegment>
                      </JointPivot>
                    </JointSegment>
                  </JointPivot>
                </JointSegment>
              </JointPivot>
            </JointSegment>
          </JointPivot>
        </JointSegment>
      </JointPivot>
    </group>
  )
}

// ─── 腿部链（髋→膝→踝→脚，URDF 精确嵌套） ──────────────
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

  return (
    <group position={hp}>
      {/* 髋 Pitch（绕 Z） */}
      <JointPivot targetAngle={hipPitch} axis="z" speed={8}>
        <JointSegment
          offset={hr}
          thickness={LEG_THICK}
          color={METAL_COLOR}
          jointRadius={JOINT_R_HIP}
        >
          {/* 髋 Roll（绕 X） */}
          <JointPivot targetAngle={hipRoll} axis="x" speed={8}>
            <JointSegment
              offset={hy}
              thickness={LEG_THICK}
              color={METAL_COLOR}
              jointRadius={JOINT_R_HIP * 0.9}
            >
              {/* 髋 Yaw（绕 Y） */}
              <JointPivot targetAngle={hipYaw} axis="y" speed={8}>
                <JointSegment
                  offset={kn}
                  thickness={LEG_THICK}
                  color={METAL_COLOR}
                  jointRadius={JOINT_R_HIP * 0.8}
                >
                  {/* 膝（绕 Z） */}
                  <JointPivot targetAngle={knee} axis="z" speed={8}>
                    <JointSegment
                      offset={ap}
                      thickness={CALF_THICK}
                      color={DARK_COLOR}
                      jointRadius={JOINT_R_KNEE}
                    >
                      {/* 踝 Pitch（绕 Z） */}
                      <JointPivot targetAngle={anklePitch} axis="z" speed={8}>
                        <JointSegment
                          offset={ar}
                          thickness={CALF_THICK * 0.7}
                          color={DARK_COLOR}
                          jointRadius={JOINT_R_ANKLE}
                        >
                          {/* 踝 Roll（绕 X） */}
                          <JointPivot targetAngle={ankleRoll} axis="x" speed={8}>
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
                        </JointSegment>
                      </JointPivot>
                    </JointSegment>
                  </JointPivot>
                </JointSegment>
              </JointPivot>
            </JointSegment>
          </JointPivot>
        </JointSegment>
      </JointPivot>
    </group>
  )
}

// ─── 主组件 ────────────────────────────────────────────
export function G1Humanoid({ position, rotation, joints, scale = 0.6 }: G1HumanoidProps) {
  const j = useMemo(() => joints ?? {}, [joints])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group position={[0, LIFT, 0]}>
        {/* 骨盆 */}
        <mesh castShadow position={[0, PELVIS_H / 2, 0]}>
          <boxGeometry args={[PELVIS_W, PELVIS_H, PELVIS_D]} />
          <meshStandardMaterial color={BODY_COLOR} metalness={0.5} roughness={0.35} />
        </mesh>

        {/* 腰部：yaw(Y) → roll(X) → pitch(Z) */}
        <JointPivot targetAngle={getAngle(j, 'waist_yaw_joint')} axis="y" speed={8}>
          {/* waist_yaw_link 几何 */}
          <mesh castShadow position={[0, -0.0175, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.035, 16]} />
            <meshStandardMaterial color={METAL_COLOR} metalness={0.5} roughness={0.4} />
          </mesh>

          {/* waist_roll 关节：相对 waist_yaw_link 的 origin */}
          <group position={WAIST_ROLL_POS}>
            <JointPivot targetAngle={getAngle(j, 'waist_roll_joint')} axis="x" speed={8}>
              {/* waist_roll_link 几何 */}
              <mesh castShadow position={[0, -0.0095, 0]}>
                <cylinderGeometry args={[0.035, 0.04, 0.019, 16]} />
                <meshStandardMaterial color={METAL_COLOR} metalness={0.5} roughness={0.4} />
              </mesh>

              {/* waist_pitch 关节：相对 waist_roll_link 的 origin */}
              <group position={WAIST_PITCH_POS}>
                <JointPivot targetAngle={getAngle(j, 'waist_pitch_joint')} axis="z" speed={8}>
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
                  <mesh castShadow position={HEAD_FIXED_POS}>
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
                  <mesh position={[HEAD_FIXED_POS[0], HEAD_FIXED_POS[1], HEAD_FIXED_POS[2] + HEAD_R - 0.005]}>
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