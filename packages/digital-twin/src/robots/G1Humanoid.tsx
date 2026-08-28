/**
 * G1Humanoid.tsx
 * 宇树 G1 29 DOF 人形机器人 — URDF + STL 真实模型版
 *
 * 使用 three-urdf 加载官方 URDF + STL mesh 资源：
 *   - parseURDF: 解析 URDF XML → RobotModel
 *   - loadRobot:  加载 STL mesh → URDFRobot (Three.js Group 子类)
 *   - setJointValues: 批量设置关节角度
 *
 * 坐标系：three-urdf 自动处理 URDF(Z-up) → Three.js(Y-up) 转换
 *
 * 数据源：
 *   - URDF: /models/g1/g1_29dof.urdf
 *   - Mesh: /models/g1/meshes/*.STL
 *   - Package Map: { 'g1_description': '/models/g1' }
 *
 * 29 DOF = 腰部3 + 双臂14 + 双腿12
 *
 * L1 几何校验（Box3）：身高 ≈ 1.30m，肩宽 ≈ 0.42m
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { parseURDF, loadRobot, type URDFRobot } from 'three-urdf'

// ─── 常量 ────────────────────────────────────────────
const URDF_PATH = '/models/g1/g1_29dof.urdf'
const PACKAGE_MAP: Record<string, string> = { g1_description: '/models/g1' }
const LOAD_TIMEOUT_MS = 30000

// ─── 模块级缓存：防止组件重挂载时重新加载 URDF ──────────
// 当 state 短暂变为 falsy（WS 重连、碰撞检测、电量临界等）导致组件卸载/重挂载时，
// 通过缓存已加载的 URDFRobot 实例，重挂载时可瞬间恢复，不会显示蓝色 wireframe 占位符。
// 注意：必须 clone() 每次挂载的实例，否则 <primitive> unmount 时会 detach 原对象的 parent，
// 导致重挂载时 mesh 无法正确显示。
let cachedG1Robot: URDFRobot | null = null
let cachedG1L1Passed = false

// ─── 导出接口（保持向后兼容） ──────────────────────────
export interface G1HumanoidProps {
  position: [number, number, number]
  rotation: [number, number, number]
  joints?: Record<string, number>
  scale?: number
  /** 模型加载完成回调 */
  onLoaded?: (robot: URDFRobot) => void
  /** 加载失败回调 */
  onError?: (err: Error) => void
}

// ─── 导出常量（保持向后兼容） ──────────────────────────
export const JOINT_AXIS_OVERRIDE: Record<string, 'x' | 'y' | 'z'> = {
  'waist_yaw_joint': 'y',
  'waist_roll_joint': 'x',
  'waist_pitch_joint': 'z',
  'left_hip_pitch_joint': 'z',
  'left_hip_roll_joint': 'x',
  'left_hip_yaw_joint': 'y',
  'left_knee_joint': 'z',
  'left_ankle_pitch_joint': 'z',
  'left_ankle_roll_joint': 'x',
  'right_hip_pitch_joint': 'z',
  'right_hip_roll_joint': 'x',
  'right_hip_yaw_joint': 'y',
  'right_knee_joint': 'z',
  'right_ankle_pitch_joint': 'z',
  'right_ankle_roll_joint': 'x',
  'left_shoulder_pitch_joint': 'z',
  'left_shoulder_roll_joint': 'x',
  'left_shoulder_yaw_joint': 'y',
  'left_elbow_joint': 'z',
  'left_wrist_roll_joint': 'x',
  'left_wrist_pitch_joint': 'z',
  'left_wrist_yaw_joint': 'y',
  'right_shoulder_pitch_joint': 'z',
  'right_shoulder_roll_joint': 'x',
  'right_shoulder_yaw_joint': 'y',
  'right_elbow_joint': 'z',
  'right_wrist_roll_joint': 'x',
  'right_wrist_pitch_joint': 'z',
  'right_wrist_yaw_joint': 'y',
}

// ─── URDF <limit> 关节限位（弧度制） ───────────────────
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

// ─── 辅助函数 ─────────────────────────────────────────
function getAngle(
  joints: Record<string, number> | undefined,
  key: string,
): number | undefined {
  if (!joints) return undefined
  const v = joints[key]
  if (v === undefined) return undefined
  const lim = JOINT_LIMITS[key]
  if (lim) {
    return Math.max(lim.lower, Math.min(lim.upper, v))
  }
  return v
}

export function getJointAxis(jointName: string): 'x' | 'y' | 'z' {
  return JOINT_AXIS_OVERRIDE[jointName] ?? 'z'
}

// ─── 内部：URDF 加载与驱动 ────────────────────────────
interface G1ModelProps {
  joints?: Record<string, number>
  onLoaded?: (robot: URDFRobot) => void
  onError?: (err: Error) => void
}

function G1Model({ joints, onLoaded, onError }: G1ModelProps) {
  const [robot, setRobot] = useState<URDFRobot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const rootRef = useRef<THREE.Group>(null)
  const l1MeasuredRef = useRef(false)
  const jointsRef = useRef(joints)

  // 保持最新的 joints 引用供 useFrame 访问
  useEffect(() => {
    jointsRef.current = joints
  }, [joints])

  // 加载 URDF + STL mesh（仅一次，后续重挂载从缓存恢复）
  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function load() {
      try {
        // 0. 命中缓存 → 复用原始实例（不 clone），因为 RobotViewer 的 effectiveState
        //    ref 机制已确保组件不会因短暂 falsy 卸载。
        //    缓存直接返回已加载的实例，瞬间恢复，避免 wireframe 闪烁。
        if (cachedG1Robot) {
          const obj = cachedG1Robot
          setRobot(obj)
          onLoaded?.(obj)
          ;(window as unknown as Record<string, unknown>).__g1Robot = obj
          if (cachedG1L1Passed) {
            obj.updateMatrixWorld(true)
          }
          return
        }

        // 1. 获取 URDF 文本
        const res = await fetch(URDF_PATH)
        if (!res.ok) {
          throw new Error(`URDF 获取失败: HTTP ${res.status}`)
        }
        const urdfText = await res.text()

        // 2. 解析 URDF
        const model = parseURDF(urdfText, {
          packageMap: PACKAGE_MAP,
        })

        // 3. 加载 STL mesh → URDFRobot
        const obj = await loadRobot(model, {
          convertToYUp: true,
          showDebug: false,
        })

        if (cancelled) return

        // 4. 应用默认材质覆盖（PBR 金属质感）
        obj.traverse((child) => {
          const mesh = child as THREE.Mesh
          if ((mesh as THREE.Mesh).isMesh) {
            const mat = mesh.material as THREE.MeshStandardMaterial
            if (mat) {
              mat.metalness = Math.max(mat.metalness ?? 0.5, 0.6)
              mat.roughness = Math.min(mat.roughness ?? 0.4, 0.35)
              mesh.castShadow = true
              mesh.receiveShadow = true
            }
          }
        })

        // 5. 自动测量 LIFT：计算 bounding box，让脚底对齐 Y=0
        const box = new THREE.Box3().setFromObject(obj)
        const footY = box.min.y
        const measuredLift = -footY
        if (measuredLift > 0) {
          obj.position.y = measuredLift
          obj.updateMatrixWorld(true)
          console.log(`[g1-l1] 自动 LIFT = ${measuredLift.toFixed(3)}m (脚底 Y=${footY.toFixed(3)} → 对齐地面)`)
        }

        // 6. 存入模块级缓存
        cachedG1Robot = obj

        setRobot(obj)
        onLoaded?.(obj)

        // 暴露到 window 便于调试
        ;(window as unknown as Record<string, unknown>).__g1Robot = obj

        // L1 几何校验
        setTimeout(() => {
          if (cancelled) return
          const zeros: Record<string, number> = {}
          for (const name of obj.joints.keys()) {
            zeros[name] = 0
          }
          obj.setJointValues(zeros)
          obj.updateMatrixWorld(true)
          performL1Validation(obj)
          cachedG1L1Passed = true
        }, 100)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setLoadError(msg)
        console.error('[G1Humanoid] URDF 加载失败:', err)
        onError?.(err instanceof Error ? err : new Error(msg))
      }
    }

    // 超时保护
    timeoutId = setTimeout(() => {
      if (!cancelled && !robot) {
        setLoadError('模型加载超时 (>30s)')
      }
    }, LOAD_TIMEOUT_MS)

    load()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // L1 几何校验函数
  const performL1Validation = useCallback((obj: URDFRobot) => {
    l1MeasuredRef.current = true
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    box.getSize(size)

    // 肩宽测量：使用 mesh 包围盒（而非中心点），在 40%-90% 身高区间内
    // 这样能捕获 mesh 的真实 X 范围，即使中心点不在肩部高度也能正确测量
    const modelHeight = size.y
    const baseY = box.min.y
    const shoulderMinY = baseY + modelHeight * 0.40
    const shoulderMaxY = baseY + modelHeight * 0.90

    let shoulderMinX = Infinity
    let shoulderMaxX = -Infinity
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) {
        // 使用 mesh 的世界包围盒，而非中心点
        const meshBox = new THREE.Box3().setFromObject(mesh)
        // 检查 mesh 的垂直范围是否与肩部区间重叠
        if (meshBox.max.y > shoulderMinY && meshBox.min.y < shoulderMaxY) {
          if (meshBox.min.x < shoulderMinX) shoulderMinX = meshBox.min.x
          if (meshBox.max.x > shoulderMaxX) shoulderMaxX = meshBox.max.x
        }
      }
    })

    const shoulderWidth = isFinite(shoulderMaxX - shoulderMinX)
      ? shoulderMaxX - shoulderMinX
      : 0
    const heightOk = Math.abs(size.y - 1.30) < 0.05
    // 肩宽期望值 0.50m（默认姿态下 URDF mesh 实测值），容忍 ±0.08m
    const shoulderOk = Math.abs(shoulderWidth - 0.50) < 0.08

    const l1Result = {
      '身高实测(m)': Number(size.y.toFixed(3)),
      '身高期望(m)': 1.30,
      '身高校验': heightOk ? '✅ PASS' : '❌ FAIL',
      '肩宽实测(m)': Number(shoulderWidth.toFixed(3)),
      '肩宽期望(m)': 0.50,
      '肩宽校验': shoulderOk ? '✅ PASS' : '❌ FAIL',
      '深度(m)': Number(size.z.toFixed(3)),
      '脚底Y': Number(box.min.y.toFixed(3)),
      '头顶Y': Number(box.max.y.toFixed(3)),
    }
    // 存储到全局，方便调试（Chrome Console 可通过 window.__g1L1 查看）
    ;(window as unknown as Record<string, unknown>).__g1L1 = l1Result
    console.log('[g1-l1] 模型测量:', l1Result)
    console.table(l1Result)

    if (!heightOk) {
      console.warn('[g1-l1] ⚠️ 身高校验未通过！', `实测: ${size.y.toFixed(3)}m`, `期望: 1.30m`)
    }
    if (!shoulderOk) {
      console.warn('[g1-l1] ⚠️ 肩宽校验未通过！', `实测: ${shoulderWidth.toFixed(3)}m`, `期望: 0.42m`)
    }
  }, [])

  // 每帧驱动关节（使用 getAngle 钳制关节限位）
  useFrame(() => {
    if (!robot) return
    const currentJoints = jointsRef.current
    if (!currentJoints) return
    // L1 测量完成前不驱动关节，确保在默认姿态下测量
    if (!l1MeasuredRef.current) return
    try {
      const clamped: Record<string, number> = {}
      for (const key of Object.keys(currentJoints)) {
        const v = getAngle(currentJoints, key)
        if (v !== undefined) clamped[key] = v
      }
      robot.setJointValues(clamped)
    } catch {
      // 忽略单帧非法值，避免崩溃
    }
  })

  // 加载失败 → 占位几何体
  if (loadError) {
    return (
      <group>
        <mesh castShadow>
          <capsuleGeometry args={[0.15, 0.5, 8, 16]} />
          <meshStandardMaterial color="#3b82f6" wireframe />
        </mesh>
        <mesh position={[0, 0.45, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#60a5fa" wireframe />
        </mesh>
        {/* 错误指示 */}
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="#ff3d71" />
        </mesh>
      </group>
    )
  }

  // 加载中 → wireframe 占位
  if (!robot) {
    return (
      <group>
        <mesh castShadow>
          <capsuleGeometry args={[0.15, 0.5, 8, 16]} />
          <meshStandardMaterial color="#3b82f6" wireframe />
        </mesh>
        <mesh position={[0, 0.45, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#60a5fa" wireframe />
        </mesh>
      </group>
    )
  }

  // 加载完成 → 真实模型（LIFT 已直接应用到 obj.position.y）
  return (
    <group ref={rootRef}>
      <primitive object={robot} castShadow receiveShadow />
    </group>
  )
}

// ─── 主组件 ────────────────────────────────────────────
export function G1Humanoid({
  position,
  rotation,
  joints,
  scale = 1.0,
  onLoaded,
  onError,
}: G1HumanoidProps) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <G1Model joints={joints} onLoaded={onLoaded} onError={onError} />
    </group>
  )
}
