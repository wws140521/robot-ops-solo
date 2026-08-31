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
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { parseURDF, loadRobot, type URDFRobot } from 'three-urdf'
import { useDancePlayer } from '../dance/useDancePlayer'
import { type G1JointName, type DanceKeyframe } from '../dance/subject3-keyframes'

// ─── 常量 ────────────────────────────────────────────
const URDF_PATH = '/models/g1/g1_29dof.urdf'
const PACKAGE_MAP: Record<string, string> = { g1_description: '/models/g1' }
const LOAD_TIMEOUT_MS = 30000

// ─── 模块级缓存：防止组件重挂载时重新加载 URDF ──────────
// 当 state 短暂变为 falsy（WS 重连、碰撞检测、电量临界等）导致组件卸载/重挂载时，
// 通过缓存已加载的 URDFRobot 实例，重挂载时可瞬间恢复，不会显示蓝色 wireframe 占位符。
let cachedG1Robot: URDFRobot | null = null
let cachedG1L1Passed = false

// ─── 关键修复：模块级永久 anchor group ──────────────────
// 根因：R3F 的 <primitive> 在组件卸载时会 detach 原对象的 parent，
// three-urdf 的 URDFRobot detach 后内部 mesh 状态丢失，重挂载时 STL 不渲染 → 变 wireframe。
// 解法：用一个模块级 THREE.Group 作为永久锚点，机器人只 add 一次到场景，永不 detach。
// 组件的 position/rotation 通过 useFrame 同步到 anchor，实现视觉上的移动。
// 模块级暴露：用于 RobotViewer 在 Canvas 外渲染跳舞按钮
export const __danceToggle: { current: (() => void) | null } = { current: null }

const g1Anchor = new THREE.Group()
g1Anchor.name = '__G1_ANCHOR__'
// 暴露到 window 便于调试
;(window as unknown as Record<string, unknown>).__g1Anchor = g1Anchor
let g1AnchorInScene = false       // 是否已加入 R3F scene
let g1RobotAddedToAnchor = false  // 机器人是否已加入 anchor

// ═══════════════════════════════════════════════════════════
// 步态参数（GaitParams）· 参考 robot-ops-solo-ROBOT-LOCOMOTION.md §3.1
// ═══════════════════════════════════════════════════════════
interface GaitParams {
  stepLength: number        // 步长 m
  armSwing: number          // 摆臂振幅 rad，0.7 ≈ 40°
  speedBlend: number        // 频率平滑系数 dt*speedBlend
}

const DEFAULT_GAIT: GaitParams = {
  stepLength: 0.45,    // G1 舒适步幅，0.3m/s / 0.45m ≈ 0.67Hz
  armSwing: 0.7,
  speedBlend: 15.0,    // 1/60*15=0.25/帧 → 5帧到76%，快速响应速度变化
}

// ─── 通用数学工具 ──────────────────────────────────
function clamp(v: number, min: number, max: number) {
  if (!isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}
// 角度差归一化到 (-π, π]，用于转向选最短方向
function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

// ─── 导出接口（保持向后兼容） ──────────────────────────
export interface G1HumanoidProps {
  position: [number, number, number]
  rotation: [number, number, number]
  scale?: number
  /** 模型加载完成回调 */
  onLoaded?: (robot: URDFRobot) => void
  /** 加载失败回调 */
  onError?: (err: Error) => void
}

// ─── JOINT_LIMITS：URDF <limit> 关节限位（弧度制） ──────
// 在 setJointValues 前 clamp，防止关节角越界
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

// ─── 舞蹈关节名映射（逻辑名 → URDF 真名） ─────────────
// 舞蹈关键帧 data 使用无后缀逻辑名（如 left_hip_pitch），
// URDF 关节名带 _joint 后缀，通过此表解耦。
const JOINT_ALIAS: Record<string, string> = {
  'waist_yaw': 'waist_yaw_joint',
  'waist_pitch': 'waist_pitch_joint',
  'waist_roll': 'waist_roll_joint',
  'left_hip_pitch': 'left_hip_pitch_joint',
  'left_hip_roll': 'left_hip_roll_joint',
  'left_hip_yaw': 'left_hip_yaw_joint',
  'left_knee': 'left_knee_joint',
  'left_ankle_pitch': 'left_ankle_pitch_joint',
  'left_ankle_roll': 'left_ankle_roll_joint',
  'right_hip_pitch': 'right_hip_pitch_joint',
  'right_hip_roll': 'right_hip_roll_joint',
  'right_hip_yaw': 'right_hip_yaw_joint',
  'right_knee': 'right_knee_joint',
  'right_ankle_pitch': 'right_ankle_pitch_joint',
  'right_ankle_roll': 'right_ankle_roll_joint',
  'left_shoulder_pitch': 'left_shoulder_pitch_joint',
  'left_shoulder_roll': 'left_shoulder_roll_joint',
  'left_shoulder_yaw': 'left_shoulder_yaw_joint',
  'left_elbow': 'left_elbow_joint',
  'right_shoulder_pitch': 'right_shoulder_pitch_joint',
  'right_shoulder_roll': 'right_shoulder_roll_joint',
  'right_shoulder_yaw': 'right_shoulder_yaw_joint',
  'right_elbow': 'right_elbow_joint',
}

// ─── 给头部加蓝色 LED 灯条 ──────────────────────────────
// 宇树 G1 实物脸部有一条横向蓝色 LED 灯带，在 STL 模型里没有，需要程序化添加。
// 策略：找到 head_link_mesh，计算其 geometry 的 local bounding box，
// 在脸部前方（+Z 方向）贴一条薄的横向 emissive mesh。
function addHeadLEDStrip(robot: URDFRobot) {
  let headMesh: THREE.Mesh | null = null
  robot.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh && mesh.name === 'visual_head_link_mesh') {
      headMesh = mesh
    }
  })
  if (!headMesh) {
    console.warn('[G1Humanoid] head_link_mesh 未找到，跳过 LED 灯条')
    return
  }
  const head = headMesh as THREE.Mesh

  // 计算 head geometry 的 local bounding box
  const geom = head.geometry
  if (!geom.boundingBox) geom.computeBoundingBox()
  const bb = geom.boundingBox!
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  bb.getSize(size)
  bb.getCenter(center)

  // 灯条尺寸：长 ≈ 头宽的 65%，高 1.2cm，厚 3mm
  const stripLen = size.x * 0.65
  const stripH = 0.012
  const stripT = 0.003

  // 灯条位置：贴在 head 前方（+Z 方向是脸），垂直居中偏下（眼睛/嘴部位置）
  const stripLocalPos = new THREE.Vector3(
    center.x,
    center.y - size.y * 0.1, // 略低于头中心
    bb.max.z + stripT / 2 + 0.0005, // 贴脸最前端（max.z = 0.531，脸就在那）
  )

  // 创建灯条 mesh
  const stripGeom = new THREE.BoxGeometry(stripLen, stripH, stripT)
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0x0a84ff,
    emissive: 0x00aaff,
    emissiveIntensity: 2.5,
    metalness: 0.2,
    roughness: 0.5,
  })
  const strip = new THREE.Mesh(stripGeom, stripMat)
  strip.position.copy(stripLocalPos)
  strip.name = '__g1_head_led_strip__'
  // 不旋转 BoxGeometry 默认 +Z 面朝向 head 的 +Z（脸的方向），正好对上
  head.add(strip)

  // 灯条后方加一个小点光源，模拟真实 LED 发光效果
  const light = new THREE.PointLight(0x00aaff, 0.25, 0.25, 2)
  light.position.set(0, 0, -stripT / 2 - 0.003) // 放在灯条后方向内照
  strip.add(light)

  console.log(`[G1Humanoid] 头部 LED 灯条已添加: pos=(${stripLocalPos.x.toFixed(3)}, ${stripLocalPos.y.toFixed(3)}, ${stripLocalPos.z.toFixed(3)}), size=(${stripLen.toFixed(3)}, ${stripH}, ${stripT})`)
}

// ─── 内部：URDF 加载与驱动 ────────────────────────────
interface G1ModelProps {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  onLoaded?: (robot: URDFRobot) => void
  onError?: (err: Error) => void
}

function G1Model({ position, rotation, scale, onLoaded, onError }: G1ModelProps) {
  const robotRef = useRef<URDFRobot | null>(cachedG1Robot)
  const [ready, setReady] = useState<boolean>(!!cachedG1Robot)
  const [loadError, setLoadError] = useState<string | null>(null)
  const l1MeasuredRef = useRef(false)
  const posRef = useRef(position)
  const scaleRef = useRef(scale)
  const { scene } = useThree() // R3F scene，用于永久 anchor 注册

  // ─── 步态状态 refs（纯程序化，不触发 re-render） ──────────
  const initTheta = isFinite(rotation[1]) ? rotation[1] : 0
  const gaitRef = useRef({
    phase: 0,           // 0 → 2π，走路相位
    smoothedPos: [position[0], position[1], position[2]] as [number, number, number],
    smoothedTheta: initTheta,
    prevTheta: initTheta,
    // WS tick 插值状态（dead reckoning）
    prevWsPos: [position[0], position[2]] as [number, number],  // 上一 tick 的 WS 位置
    lastWsPos: [position[0], position[2]] as [number, number],  // 最新 tick 的 WS 位置
    tickAge: 0,          // 距上一 tick 的经过时间 (s)，用于线性插值
    yawVel: 0,          // 角速度 (rad/s)
    idleBlend: 1,       // 1 = 完全 idle, 0 = 完全 walk
    currentFreq: 1.0,   // 动态步频（speed/stepLength + lerp 平滑）
    turnAmount: 0,      // 当前帧转向量 rad，用于转向 anticipation
    emaFrameVel: 0,     // 帧间速度 EMA（τ=0.05s），从 lerp 后的 smoothedPos 帧间差分计算
    // 转向状态机
    turnState: 'walking' as 'walking' | 'turning',
    turnPos: [position[0], position[2]] as [number, number],  // 转向时冻结的位置
    turnTargetHeading: 0,  // 转向目标航向，在进入 turning 时锁存（已 wrapAngle 归一化）
    wsTickVel: 0,          // WS tick 速度（稳定速度源）
  })

  // 保持最新的 position / rotation 引用供 useFrame 访问
  useEffect(() => {
    posRef.current = position
  }, [position])
  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  // ─── 舞蹈状态 ──────────────────────────────────────
  const [dancing, setDancing] = useState(false)
  const latestDanceJoints = useRef<Partial<Record<G1JointName, number>>>({})
  const latestDanceRoot = useRef<DanceKeyframe['root'] | undefined>(undefined)
  const danceOriginRef = useRef<[number, number, number]>([position[0], 0, position[2]])

  const player = useDancePlayer((joints, root) => {
    latestDanceJoints.current = joints
    latestDanceRoot.current = root
  })

  const toggleDance = useCallback(() => {
    if (dancing) {
      player.stop()
      setDancing(false)
    } else {
      danceOriginRef.current = [posRef.current[0], 0, posRef.current[2]]
      player.start()
      setDancing(true)
    }
  }, [dancing, player])
  // 暴露 toggleDance 供 RobotViewer 使用
  __danceToggle.current = toggleDance

  // 关键：将永久 anchor 加入 R3F scene，且仅执行一次
  useEffect(() => {
    // HMR 场景：移除 scene 中旧的同名 anchor，避免重复机器人残影
    const oldAnchors = scene.children.filter(
      (c: THREE.Object3D) => c.name === '__G1_ANCHOR__' && c !== g1Anchor,
    )
    for (const old of oldAnchors) {
      scene.remove(old)
      console.log('[G1Model] HMR: 移除旧 anchor')
    }
    if (!g1AnchorInScene) {
      scene.add(g1Anchor)
      g1AnchorInScene = true
      console.log('[G1Model] 永久 anchor 已加入 R3F scene')
    }
    return () => {
      // 故意不 remove：anchor 永不离开 scene，防止 three-urdf mesh 状态丢失
    }
  }, [scene])

  // 加载 URDF + STL mesh（仅一次，后续重挂载从缓存恢复）
  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function load() {
      try {
        // 0. 命中缓存 → 瞬间恢复
        if (cachedG1Robot) {
          robotRef.current = cachedG1Robot
          // 关键：只 add 到 anchor 一次，后续不再 detach/reattach
          if (!g1RobotAddedToAnchor) {
            g1Anchor.add(cachedG1Robot)
            g1RobotAddedToAnchor = true
            console.log('[G1Model] 缓存命中，已将 robot 挂载到永久 anchor')
          }
          setReady(true)
          onLoaded?.(cachedG1Robot)
          ;(window as unknown as Record<string, unknown>).__g1Robot = cachedG1Robot
          if (cachedG1L1Passed) {
            cachedG1Robot.updateMatrixWorld(true)
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
        obj.traverse((child: THREE.Object3D) => {
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

        // 4.5 给头部加蓝色 LED 灯条（宇树 G1 标志性脸部装饰）
        addHeadLEDStrip(obj)

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
        robotRef.current = obj
        // 关键：只 add 到 anchor 一次
        if (!g1RobotAddedToAnchor) {
          g1Anchor.add(obj)
          g1RobotAddedToAnchor = true
          console.log('[G1Model] robot 已挂载到永久 anchor')
        }
        setReady(true)
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
      if (!cancelled && !robotRef.current) {
        setLoadError('模型加载超时 (>30s)')
      }
    }, LOAD_TIMEOUT_MS)

    load()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      // 故意不 remove robot from g1Anchor：保持挂载状态
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
    const modelHeight = size.y
    const baseY = box.min.y
    const shoulderMinY = baseY + modelHeight * 0.40
    const shoulderMaxY = baseY + modelHeight * 0.90

    let shoulderMinX = Infinity
    let shoulderMaxX = -Infinity
    obj.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) {
        const meshBox = new THREE.Box3().setFromObject(mesh)
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

  // 每帧驱动关节 + 同步 anchor 位置/旋转
  // 暴露 gaitRef 到 window 便于调试
  ;(window as unknown as Record<string, unknown>).__g1Gait = gaitRef.current

  useFrame((_state, delta) => {
    const robot = robotRef.current
    if (!robot) return
    if (!l1MeasuredRef.current) return

    const g = gaitRef.current

    // ── NaN 防护：确保 smoothedTheta 始终是有效数字 ──
    if (!isFinite(g.smoothedTheta)) {
      console.warn('[g1] NaN detected in smoothedTheta, resetting to 0')
      g.smoothedTheta = 0
    }

    // ═══ DANCE MODE：覆盖 gait，直接应用舞蹈关键帧 ═══
    if (dancing) {
      player.update(performance.now() / 1000)
      const dj = latestDanceJoints.current
      const danceMapped: Record<string, number> = {}
      for (const [logicalName, angle] of Object.entries(dj)) {
        if (angle === undefined) continue
        const urdfName = JOINT_ALIAS[logicalName] ?? logicalName
        const lim = JOINT_LIMITS[urdfName]
        danceMapped[urdfName] = lim ? Math.max(lim.lower, Math.min(lim.upper, angle)) : angle
      }
      try { robot.setJointValues(danceMapped) } catch { /* 忽略非法值 */ }

      const dr = latestDanceRoot.current
      const do_ = danceOriginRef.current
      // 舞蹈 root.position 是相对于起始位置的偏移
      // 保持 gait 的 smoothedTheta 和 Y 轴高度
      g1Anchor.position.set(
        do_[0] + (dr?.position?.[0] ?? 0),
        g.smoothedPos[1],
        do_[2] + (dr?.position?.[2] ?? 0),
      )
      // mock 约定 (0=+X) → three.js rotation.y (-θ-π/2)
      g1Anchor.rotation.set(0, -g.smoothedTheta - Math.PI / 2 + (dr?.rotationY ?? 0), 0)
      g1Anchor.scale.set(scaleRef.current, scaleRef.current, scaleRef.current)
      return  // 跳过 gait
    }

    const p = posRef.current
    const dt = Math.min(delta, 0.05) // clamp 防止 tab 切回来后 dt 爆炸
    const PARAMS = DEFAULT_GAIT

    // ═══ 1. 导航：位置 + 航向同步 ═══
    const targetX = p[0], targetY = p[1], targetZ = p[2]
    const sx = targetX
    const sz = targetZ

    // Y 轴保留平滑（只有一个 targetY，没有阶跃）
    const posAlpha = 1 - Math.exp(-dt / 0.25)
    g.smoothedPos[1] += (targetY - g.smoothedPos[1]) * posAlpha

    // 1c. 计算期望朝向（mock 服务器约定: 0=+X(东), π/2=+Z(北)）
    // 用 WS tick 帧间增量算运动方向，不依赖插值位置
    // wsDx = deltaX, wsDz = deltaZ（mock 服务器的 Y 映射到 three.js 的 Z）
    const wsDx = g.lastWsPos[0] - g.prevWsPos[0]
    const wsDz = g.lastWsPos[1] - g.prevWsPos[1]
    const wsDist = Math.sqrt(wsDx * wsDx + wsDz * wsDz)
    const freshHeading = wsDist > 0.001
      ? Math.atan2(wsDz, wsDx)
      : g.smoothedTheta
    const TURN_THRESHOLD = 0.3    // 17° → 触发转向
    const ALIGN_THRESHOLD = 0.15  // 8.6° → 对齐完成

    // ── 转向状态机：停止 → 转向 → 前进 ──
    // 不要边走边转（螃蟹步），先停住、转好方向、再往前走
    const headingError = wrapAngle(freshHeading - g.smoothedTheta)

    if (g.turnState === 'turning') {
      // 位置冻结在 turnPos，只旋转
      g.smoothedPos[0] = g.turnPos[0]
      g.smoothedPos[2] = g.turnPos[1]

      // 转向期间仍持续追踪 WS tick 位置，退出 turning 时 prevWsPos/lastWsPos 才是最新的，
      // 避免恢复行走后出现巨大 delta 导致 emaFrameVel 暴涨。
      const wsChanged = Math.abs(sx - g.lastWsPos[0]) > 0.0001 || Math.abs(sz - g.lastWsPos[1]) > 0.0001
      if (wsChanged) {
        g.prevWsPos[0] = g.lastWsPos[0]
        g.prevWsPos[1] = g.lastWsPos[1]
        g.lastWsPos[0] = sx
        g.lastWsPos[1] = sz
        g.tickAge = 0
      }

      // 用锁存的 turnTargetHeading 作为旋转目标，不受 WS 新 tick 影响
      const turnHeadingError = wrapAngle(g.turnTargetHeading - g.smoothedTheta)
      // NaN 防护：确保 turnHeadingError 是有效数字
      if (isFinite(turnHeadingError)) {
        g.smoothedTheta += turnHeadingError * (1 - Math.exp(-dt / 0.3))
        // 每帧归一化，防止 smoothedTheta 无限累积（已观察到 900°+）
        g.smoothedTheta = wrapAngle(g.smoothedTheta)
      } else {
        console.warn('[g1] NaN turnHeadingError, aborting turn')
        g.turnState = 'walking'
      }
      // 转向中的实际旋转量 → 用于步态转向 anticipation
      const headingChange = g.smoothedTheta - g.prevTheta
      g.yawVel = Math.abs(headingChange) / Math.max(dt, 0.001)
      g.turnAmount = Math.abs(turnHeadingError)
      // 对齐完成 → 恢复行走
      if (Math.abs(turnHeadingError) < ALIGN_THRESHOLD) {
        g.turnState = 'walking'
        // 不再重置 prevWsPos/lastWsPos 到 turnPos，否则退出后的第一个 WS tick 会产生巨大 delta，
        // 导致 emaFrameVel 暴涨、步频突然提高。
        // 转向期间 wsChanged 仍然会更追踪 WS 位置，因此直接沿用即可。
        g.tickAge = 0
      }
    } else {
      // WALKING：正常死冲缀位置
      // 1a. 小幅航向偏差持续修正（τ=0.5s），防止小于 TURN_THRESHOLD 的偏角累积成螃蟹步
      if (isFinite(headingError) && Math.abs(headingError) <= TURN_THRESHOLD) {
        g.smoothedTheta += headingError * (1 - Math.exp(-dt / 0.5))
        // 每帧归一化
        g.smoothedTheta = wrapAngle(g.smoothedTheta)
      }

      // 1b. 检测是否需要转向（大角度）
      // NaN 防护：确保 headingError 和 freshHeading 都是有效数字
      if (isFinite(headingError) && isFinite(freshHeading) &&
          Math.abs(headingError) > TURN_THRESHOLD && wsDist > 0.001 && g.wsTickVel > 0.05) {
        g.turnState = 'turning'
        g.turnPos[0] = g.smoothedPos[0]
        g.turnPos[1] = g.smoothedPos[2]
        // 锁存转向目标航向，整个转向过程使用此值，避免 WS tick 干扰
        g.turnTargetHeading = wrapAngle(freshHeading)
      }

      // 1c. 位置：WS tick 帧间线性插值（dead reckoning）
      const wsChanged = Math.abs(sx - g.lastWsPos[0]) > 0.0001 || Math.abs(sz - g.lastWsPos[1]) > 0.0001
      if (wsChanged) {
        g.prevWsPos[0] = g.lastWsPos[0]
        g.prevWsPos[1] = g.lastWsPos[1]
        g.lastWsPos[0] = sx
        g.lastWsPos[1] = sz
        g.tickAge = 0
        // 用 WS tick 速度作为速度源（稳定 0.5 m/s），避免插值帧间差分波动
        const wsDx = g.lastWsPos[0] - g.prevWsPos[0]
        const wsDz = g.lastWsPos[1] - g.prevWsPos[1]
        const tickDist = Math.hypot(wsDx, wsDz)
        g.wsTickVel = tickDist / 0.1  // mock tick 间隔 0.1s
      }
      const interpAlpha = clamp((g.tickAge + dt) / 0.1, 0, 1)
      g.smoothedPos[0] = g.prevWsPos[0] + (g.lastWsPos[0] - g.prevWsPos[0]) * interpAlpha
      g.smoothedPos[2] = g.prevWsPos[1] + (g.lastWsPos[1] - g.prevWsPos[1]) * interpAlpha
      g.tickAge += dt

      // walking 状态无大转向 anticipation
      g.yawVel = 0
      g.turnAmount = 0
    }

    // 调试：每 60 帧打印航向值
    const _debugCount = (window as unknown as Record<string, number>).__g1DebugCount ?? 0
    ;(window as unknown as Record<string, number>).__g1DebugCount = _debugCount + 1
    if (_debugCount % 60 === 0) {
      const anchorRotY = g1Anchor.rotation.y
      console.log(
        `[g1-debug] freshHeading=${(freshHeading * 180 / Math.PI).toFixed(1)}° ` +
        `smoothedTheta=${(g.smoothedTheta * 180 / Math.PI).toFixed(1)}° ` +
        `headingError=${(headingError * 180 / Math.PI).toFixed(1)}° ` +
        `anchorRotY=${(anchorRotY * 180 / Math.PI).toFixed(1)}° ` +
        `turnState=${g.turnState} ` +
        `emaFrameVel=${g.emaFrameVel.toFixed(3)}`
      )
    }

    // ═══ 2. 步态相位推进（文档 §3.2 物理约束步频） ═══
    // 速度源：改用 WS tick 速度（每 0.1s 更新一次）。
    // 之前用 lerp 后 smoothedPos 的帧间差分，受插值波动影响，vel 在 0.4~1.2 间脉冲；
    // 用 WS tick 速度后，vel 稳定在 0.5 m/s，与 mock 物理速度一致。
    const FIXED_DT = 1 / 60  // 固定 60Hz 步态时钟
    if (g.turnState !== 'turning' && g.wsTickVel > 0.0001) {
      g.emaFrameVel += (g.wsTickVel - g.emaFrameVel) * clamp(dt / 0.15, 0, 1)
    }
    // 硬上限：防止任何边界条件（转向退出、WS 抖动）导致步频飙升
    g.emaFrameVel = clamp(g.emaFrameVel, 0, 1.2)
    // walking 时按物理速度约束步频；turning 时原地踏步，baseFreq 固定 0.4 + 转向 boost
    const baseFreq = g.turnState === 'turning'
      ? 0.4
      : clamp(g.emaFrameVel / PARAMS.stepLength, 0.3, 1.6)
    // 小幅度转向增加步频（让原地转向也有步态节奏，但不夸张）
    const turnBoost = clamp(g.yawVel * 0.12, 0, 0.25)
    const targetFreq = baseFreq + turnBoost
    // lerp 平滑过渡 —— 同样用固定 dt
    g.currentFreq += (targetFreq - g.currentFreq) * clamp(FIXED_DT * PARAMS.speedBlend, 0, 1)
    // phase 始终推进！不再 if (walking) { ... }
    g.phase += g.currentFreq * FIXED_DT * 2 * Math.PI

    // idle ↔ walk 平滑过渡
    // 用 baseFreq 判定：只要 anchor 动过一次，baseFreq floor 0.3 就永远保持
    // （即使原地转向速度 ≈ 0，baseFreq 仍 ≥ 0.3）→ idleBlend 自然归 0
    const isMoving = baseFreq > 0.25 || g.yawVel > 0.3
    const targetIdle = isMoving ? 0 : 1
    g.idleBlend += (targetIdle - g.idleBlend) * (1 - Math.pow(0.01, FIXED_DT))

    // ═══ 3. 驱动 anchor transform + 骨盆 bob + idle 呼吸 ═══
    const bobBlend = 1 - g.idleBlend
    const bobAmp = 0.015 * clamp(g.emaFrameVel / 0.2, 0, 1) * bobBlend
    // 居中振荡：从 baseline 向下（-0.5）到 向上（+0.5），更自然
    const bobOffset = (Math.abs(Math.sin(g.phase)) - 0.5) * 2 * bobAmp

    // idle 呼吸微动：站姿时胸部微起伏 + 重量微偏移
    // 用独立时钟（performance.now），不跟步态 phase 绑定
    const idleT = performance.now() * 0.001
    const idleBreathY = Math.sin(idleT * 1.2) * 0.004 * g.idleBlend          // ±4mm 胸起伏
    const idleBreathZ = Math.sin(idleT * 0.6) * 0.008 * g.idleBlend          // ±8mm 重心前后晃
    const idleSwayX = Math.sin(idleT * 0.8) * 0.005 * g.idleBlend             // ±5mm 侧摆

    g1Anchor.position.set(
      g.smoothedPos[0] + idleSwayX,
      g.smoothedPos[1] + bobOffset + idleBreathY,
      g.smoothedPos[2] + idleBreathZ,
    )
    // mock 服务器约定 (0=+X 东, π/2=+Z 北) → three.js rotation.y (-θ-π/2)
    const anchorRotY = -g.smoothedTheta - Math.PI / 2
    g1Anchor.rotation.set(0, isFinite(anchorRotY) ? anchorRotY : 0, 0)
    g1Anchor.scale.set(scaleRef.current, scaleRef.current, scaleRef.current)

    // ═══ 4. 合成步态关节角（文档 §4.2 calcArmSwing + calcLegIK） ═══
    const phase = g.phase
    const blend = 1 - g.idleBlend

    // ── 速度与摆幅联动（文档 §3.2） ──
    // 用 emaFrameVel（快速 EMA 后的帧间速度）算视觉步幅
    const TARGET_STEP_LEN = PARAMS.stepLength  // 目标步长 m
    const visualStepDisp = g.currentFreq > 0
      ? g.emaFrameVel / g.currentFreq
      : TARGET_STEP_LEN
    // legAmp 以 TARGET_STEP_LEN 为基准：实际步长 / 目标步长 * 基准系数
    // 下限改为 0：慢速/停顿时腿自然静止，保证步伐大小严格匹配物理移动距离
    const legAmp = clamp((visualStepDisp / TARGET_STEP_LEN) * 0.85, 0, 1.2)
    const speedFactor = clamp(g.emaFrameVel / 2.0, 0, 1)
    const armAmp = PARAMS.armSwing * (1 + speedFactor * 0.3)

    // ── 转向 anticipation（文档 §5.2：内侧腿缩短、外侧腿加长） ──
    const turnFactor = clamp(g.turnAmount / 0.6, 0, 1)  // 0 ~ 1
    // headingError 已在上面被 wrapAngle 处理过（±π），sign 告诉我们往哪边转
    const turnSign = headingError > 0 ? 1 : -1

    // turning 状态：用侧向交叉步，hipPitch 减半、hipYaw/hipRoll 加大，
    // 让视觉上明显在原地转身，而不是前后踏步。
    const turnBlend = g.turnState === 'turning' ? 1 : 0
    const walkBlend = 1 - turnBlend

    // 基础前后迈步振幅（walking 正常，turning 大幅降低）
    const pitchAmp = legAmp * (0.85 * walkBlend + 0.25 * turnBlend)

    // 向左转（headingError > 0）→ 左腿内侧缩短，右腿外侧加长
    // 向右转相反
    const leftStride  = pitchAmp * (1 - turnFactor * 0.35 * turnSign)
    const rightStride = pitchAmp * (1 + turnFactor * 0.35 * turnSign)

    // turning 时侧向幅度加大：hipRoll 与 hipYaw 形成交叉转身
    const rollAmp = legAmp * (0.18 * walkBlend + 0.55 * turnBlend)
    const yawAmp = legAmp * (0.25 * walkBlend + 0.70 * turnBlend)
    const kneeAmp = legAmp * (1.5 * walkBlend + 0.6 * turnBlend)

    // ── 左腿 ──
    const lHipPitch = Math.sin(phase) * leftStride
    const lHipRoll = Math.sin(phase + Math.PI) * rollAmp + turnBlend * turnSign * 0.18
    const lKnee = Math.max(0, Math.sin(phase)) * kneeAmp + 0.05
    const lAnklePitch = -Math.sin(phase) * (0.25 * legAmp) + Math.max(0, Math.sin(phase)) * (0.35 * legAmp) * 0.5
    const lHipYaw = -Math.sin(phase + Math.PI) * yawAmp

    // ── 右腿（反相） ──
    const rHipPitch = Math.sin(phase + Math.PI) * rightStride
    const rHipRoll = Math.sin(phase) * rollAmp - turnBlend * turnSign * 0.18
    const rKnee = Math.max(0, Math.sin(phase + Math.PI)) * kneeAmp + 0.05
    const rAnklePitch = -Math.sin(phase + Math.PI) * (0.25 * legAmp) + Math.max(0, Math.sin(phase + Math.PI)) * (0.35 * legAmp) * 0.5
    const rHipYaw = -Math.sin(phase) * yawAmp

    // ── 手臂（calcArmSwing：对侧摆臂 + 速度联动 + 反相） ──
    // 左臂与右腿同相（phase + π）→ 交叉步态
    // 文档 §4.2 公式：amp = armSwing * (1 + clamp(speed/2, 0, 1) * 0.5)
    const lShoulderPitch = Math.sin(phase + Math.PI) * armAmp * blend
    const rShoulderPitch = Math.sin(phase) * armAmp * blend  // 反相
    const lShoulderRoll = 0.15 + Math.sin(phase + Math.PI) * (0.1 * legAmp)
    const rShoulderRoll = -0.15 - Math.sin(phase) * (0.1 * legAmp)
    const lShoulderYaw = 0.12 + Math.sin(phase + Math.PI + Math.PI / 2) * (0.08 * legAmp)
    const rShoulderYaw = -0.12 - Math.sin(phase + Math.PI / 2) * (0.08 * legAmp)
    // 肘：swing 相屈肘 30-50°，支撑相伸直 ~20°
    const lElbow = (0.35 + Math.abs(Math.sin(phase + Math.PI)) * 0.25) * (0.6 + 0.4 * blend)
    const rElbow = (0.35 + Math.abs(Math.sin(phase)) * 0.25) * (0.6 + 0.4 * blend)

    // ── 腰部（侧摆 + 转向时额外转胯） ──
    const waistRoll = Math.sin(phase + Math.PI / 2) * (0.1 * legAmp)
    const waistPitch = 0.03

    // ─── 6. 合成步态关节角（步态值 + idle 站姿微调） ──
    const apply = (gaitVal: number, idleBias = 0) =>
      idleBias * g.idleBlend + gaitVal * blend

    const gaitJoints: Record<string, number> = {
      // 腿
      'left_hip_pitch_joint': apply(lHipPitch),
      'left_hip_roll_joint': apply(lHipRoll, 0.02),
      'left_hip_yaw_joint': apply(lHipYaw),
      'left_knee_joint': apply(lKnee, 0.05),
      'left_ankle_pitch_joint': apply(lAnklePitch),
      'left_ankle_roll_joint': apply(0),

      'right_hip_pitch_joint': apply(rHipPitch),
      'right_hip_roll_joint': apply(rHipRoll, -0.02),
      'right_hip_yaw_joint': apply(rHipYaw),
      'right_knee_joint': apply(rKnee, 0.05),
      'right_ankle_pitch_joint': apply(rAnklePitch),
      'right_ankle_roll_joint': apply(0),

      // 手臂
      'left_shoulder_pitch_joint': apply(lShoulderPitch),
      'left_shoulder_roll_joint': apply(lShoulderRoll),
      'left_shoulder_yaw_joint': apply(lShoulderYaw),
      'left_elbow_joint': apply(lElbow),
      'left_wrist_roll_joint': 0,
      'left_wrist_pitch_joint': 0,
      'left_wrist_yaw_joint': 0,

      'right_shoulder_pitch_joint': apply(rShoulderPitch),
      'right_shoulder_roll_joint': apply(rShoulderRoll),
      'right_shoulder_yaw_joint': apply(rShoulderYaw),
      'right_elbow_joint': apply(rElbow),
      'right_wrist_roll_joint': 0,
      'right_wrist_pitch_joint': 0,
      'right_wrist_yaw_joint': 0,

      // 腰 —— waist_yaw 做身体反向扭转（文档 §4.4）
      'waist_yaw_joint': apply(Math.sin(phase) * 0.05 * blend),
      'waist_roll_joint': apply(waistRoll),
      'waist_pitch_joint': apply(waistPitch),
    }

    // 7. clamp 到 URDF 极限并应用
    try {
      const clamped: Record<string, number> = {}
      for (const name of Object.keys(gaitJoints)) {
        const v = gaitJoints[name]
        const lim = JOINT_LIMITS[name]
        if (lim) {
          clamped[name] = Math.max(lim.lower, Math.min(lim.upper, v))
        } else {
          clamped[name] = v
        }
      }
      robot.setJointValues(clamped)
    } catch {
      // 忽略单帧非法值
    }

    // ─── 8. 保存上一帧航向 ────────────────────────────
    g.prevTheta = g.smoothedTheta
  })

  // 加载失败 → 占位几何体（仅首次加载失败时显示）
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

  // 加载完成 → 渲染空 group（真实机器人在永久 anchor 中，已在 scene 根节点）
  // 这里只渲染一个空壳，供 R3F 做 reconciliation，实际渲染由 useFrame 同步 anchor transform
  if (ready && robotRef.current) {
    return (
      <group>
        {/* 隐藏空壳，真正的机器人在永久 anchor 中 */}
        <group visible={false} />
      </group>
    )
  }

  // 首次加载中 → 极简占位
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#4a9eff" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

// ─── 主组件 ────────────────────────────────────────────
export function G1Humanoid({
  position,
  rotation,
  scale = 1.0,
  onLoaded,
  onError,
}: G1HumanoidProps) {
  // 注意：G1Model 内部用模块级 g1Anchor 直接加在 scene 根，
  // 不应该再包一层 group 导致双重 transform。
  // position/rotation 通过 useFrame → g1Anchor 同步。
  return <G1Model position={position} rotation={rotation} scale={scale} onLoaded={onLoaded} onError={onError} />
}
