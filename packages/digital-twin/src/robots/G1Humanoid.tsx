// G1Humanoid.tsx
// 宇树 G1 29 DOF 人形机器人 — URDF + STL 真实模型版
//
// 用 three-urdf 加载官方 URDF + STL mesh：
//   parseURDF 解析 XML，loadRobot 加载 STL，setJointValues 批量设关节角
// three-urdf 会自动处理 URDF(Z-up) → Three.js(Y-up) 的坐标转换
//
// 资源路径：
//   URDF: /models/g1/g1_29dof.urdf
//   Mesh: /models/g1/meshes/*.STL
//   Package Map: { 'g1_description': '/models/g1' }
//
// 29 DOF = 腰部3 + 双臂14 + 双腿12
// L1 几何校验（Box3）：身高大概 1.30m，肩宽大概 0.42m，差太多就要怀疑模型是不是加载错了
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { parseURDF, loadRobot, type URDFRobot } from 'three-urdf'
import { useDancePlayer } from '../dance/useDancePlayer'
import { type G1JointName, type DanceKeyframe } from '../dance/subject3-keyframes'
import {
  clamp,
  wrapAngle,
  stepFrequency,
  actualStepLength,
  legAmplitude,
  stridePitchAmplitude,
  trackHeading,
  thetaToRotY,
  tickInterpAlpha,
  measuredTickInterval,
  emaTickInterval,
  emaVelocity,
} from './gaitMath'

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
// 2026-09-09 g1AnchorInScene flag 已移除：跨 Canvas 导航时 flag 与实际 scene 脱钩，
// 改为挂载 effect 里按 g1Anchor.parent !== scene 实际判断
let g1RobotAddedToAnchor = false  // 机器人是否已加入 anchor

// ═══════════════════════════════════════════════════════════
// 步态参数（GaitParams）· 参考 robot-ops-solo-ROBOT-LOCOMOTION.md §3.1
// ═══════════════════════════════════════════════════════════
interface GaitParams {
  stepLength: number        // 单步步长 m（一个相位周期迈两步，走 2×stepLength）
  armSwing: number          // 摆臂振幅 rad，0.7 ≈ 40°
  speedBlend: number        // 频率平滑系数 dt*speedBlend
}

const DEFAULT_GAIT: GaitParams = {
  stepLength: 0.45,    // G1 舒适步幅；0.5 m/s ÷ (2×0.45) ≈ 0.56 Hz 步频
  armSwing: 0.7,
  speedBlend: 15.0,    // 1/60*15=0.25/帧 → 5帧到76%，快速响应速度变化
}

// 髋关节到脚底的大致腿长，算步幅摆角用
const LEG_LEN = 0.78

// ─── 导出接口（保持向后兼容） ──────────────────────────
export interface G1HumanoidProps {
  position: [number, number, number]
  rotation: [number, number, number]
  scale?: number
  // 模型加载完成回调
  onLoaded?: (robot: URDFRobot) => void
  // 加载失败回调
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
    phase: 0,           // 0 → 2π，走路相位（一个周期 = 左右各一步 = 2 步）
    smoothedPos: [position[0], position[1], position[2]] as [number, number, number],
    smoothedTheta: initTheta,
    prevTheta: initTheta,
    // WS tick 插值状态（dead reckoning）
    prevWsPos: [position[0], position[2]] as [number, number],  // 上一 tick 的 WS 位置
    lastWsPos: [position[0], position[2]] as [number, number],  // 最新 tick 的 WS 位置
    tickAge: 0,          // 距上一 tick 的经过时间 (s)，用于线性插值
    tickIntervalEma: 0.1, // 实测 tick 间隔（EMA），不再硬编码 0.1s
    velEmaX: 0,          // EMA 速度向量 X 分量 (m/s)
    velEmaZ: 0,          // EMA 速度向量 Z 分量 (m/s)
    yawVel: 0,          // 角速度 (rad/s)
    idleBlend: 1,       // 1 = 完全 idle, 0 = 完全 walk
    currentFreq: 1.0,   // 动态步频（周期/秒），lerp 平滑
    turnAmount: 0,      // 当前帧转向量 rad，用于转向 anticipation
    emaFrameVel: 0,     // 平滑后的行走速度 (m/s)，bob/摆幅用
    // 转向状态机：只驱动腿部交叉步样式，不再冻结位置/锁存航向
    // （mock 是边走边转的弧线运动，冻结后退出瞬移 0.5m+，肉眼就是抽搐）
    turnState: 'walking' as 'walking' | 'turning',
    turnBlend: 0,      // 交叉步混合系数 0~1（0.25s 时间常数渐变，防步态硬切跳变）
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
    // 2026-09-09 修复跨视图导航后 G1 永久消失：原模块级 flag（g1AnchorInScene）
    // 在舰队↔单机切换时新 Canvas 的新 scene 里仍为 true，导致永远不再 add，
    // anchor 一直挂在已销毁的旧 scene 上——G1 从此不可见，只能整页刷新。
    // 改为按「当前 scene 实际持有」判断：Object3D.add 会先把 anchor 从旧 parent
    // 摘下来再挂到新 scene，跨 Canvas 重挂天然安全（与 PeanutBot 同一模式）。
    if (g1Anchor.parent !== scene) {
      scene.add(g1Anchor)
      console.log('[G1Model] anchor 已加入当前 scene（首次挂载/跨视图导航重挂）')
    }
    // 挂载时确保可见（可能刚从别的设备切回来）
    g1Anchor.visible = true
    return () => {
      // 故意不 remove：anchor 永不离开 scene，防止 three-urdf mesh 状态丢失
      // 但卸载时必须藏起来，不然切换到其他设备时 G1 还杵在场景里
      g1Anchor.visible = false
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
            // 2026-09-09 修复切路由回来后 G1 冻结（模型不动、HUD 却跟着遥测走）：
            // l1MeasuredRef 是组件级 ref，useFrame 靠它放行位置/步态同步；
            // 首次加载经 performL1Validation 置 true，但本缓存命中路径原来漏了这步，
            // 重挂后每帧都在守卫处 return，anchor 永远停在旧位置。
            // L1 首次已通过（cachedG1L1Passed），直接放行。
            l1MeasuredRef.current = true
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
      // G1 URDF 前向 = 局部 +X → rotation.y = -θ（实测脚踝连线标定，非 -θ-π/2）
      g1Anchor.rotation.set(0, thetaToRotY(g.smoothedTheta) + (dr?.rotationY ?? 0), 0)
      g1Anchor.scale.set(scaleRef.current, scaleRef.current, scaleRef.current)
      return  // 跳过 gait
    }

    const p = posRef.current
    const dt = Math.min(delta, 0.05) // clamp 防止 tab 切回来后 dt 爆炸
    const PARAMS = DEFAULT_GAIT

    const targetX = p[0], targetY = p[1], targetZ = p[2]
    const sx = targetX
    const sz = targetZ

    // Y 轴保留平滑（只有一个 targetY，没有阶跃）
    const posAlpha = 1 - Math.exp(-dt / 0.25)
    g.smoothedPos[1] += (targetY - g.smoothedPos[1]) * posAlpha

    // ═══ 1. 位置 dead reckoning（实测 tick 间隔 + 速度向量 EMA）═══
    // mock 位置四舍五入到 0.01m，逐 tick 差分算航向会 ±8° 振荡；
    // 把每 tick 位移 EMA 成速度向量，航向/速度都从它取，噪声自然被滤掉
    const wsChanged = Math.abs(sx - g.lastWsPos[0]) > 0.0001 || Math.abs(sz - g.lastWsPos[1]) > 0.0001
    if (wsChanged) {
      // 本次 tick 的实测间隔（tickAge + dt 是从上一 tick 到本帧的真实耗时）
      const measured = measuredTickInterval(g.tickAge, dt)
      g.tickIntervalEma = emaTickInterval(g.tickIntervalEma, measured)
      const dx = sx - g.lastWsPos[0]
      const dz = sz - g.lastWsPos[1]
      g.velEmaX = emaVelocity(g.velEmaX, dx, measured)
      g.velEmaZ = emaVelocity(g.velEmaZ, dz, measured)
      g.prevWsPos[0] = g.lastWsPos[0]
      g.prevWsPos[1] = g.lastWsPos[1]
      g.lastWsPos[0] = sx
      g.lastWsPos[1] = sz
      g.tickAge = 0
    }
    // 长时间没有新 tick（机器人停了）→ 速度向零衰减
    if (g.tickAge > 0.4) {
      const decay = Math.exp(-dt / 0.4)
      g.velEmaX *= decay
      g.velEmaZ *= decay
    }
    // 帧间线性插值：用实测间隔而不是硬编码 0.1s，网络抖动也不出锯齿
    const interpAlpha = tickInterpAlpha(g.tickAge, dt, g.tickIntervalEma)
    g.smoothedPos[0] = g.prevWsPos[0] + (g.lastWsPos[0] - g.prevWsPos[0]) * interpAlpha
    g.smoothedPos[2] = g.prevWsPos[1] + (g.lastWsPos[1] - g.prevWsPos[1]) * interpAlpha
    g.tickAge += dt

    // ═══ 2. 航向连续平滑跟踪 + 转向状态机（纯腿部样式）═══
    const speed = Math.hypot(g.velEmaX, g.velEmaZ)
    // mock 约定: 0=+X(东), π/2=+Z(北)；mock 的 Y 映射到 three.js 的 Z
    const freshHeading = speed > 0.05 ? Math.atan2(g.velEmaZ, g.velEmaX) : g.smoothedTheta
    const headingError = wrapAngle(freshHeading - g.smoothedTheta)

    // τ=0.18s 连续跟踪：mock 转弯速率 1.5 rad/s 时稳态滞后 0.27 rad，
    // 视觉上就是自然的弧线转弯，不再有冻结-瞬移
    g.smoothedTheta = trackHeading(g.smoothedTheta, freshHeading, dt, 0.18)

    // 转向状态机只决定腿部要不要摆交叉步，位置和航向照常走
    const TURN_THRESHOLD = 0.3    // 17° → 急转时切交叉步
    const ALIGN_THRESHOLD = 0.15  // 8.6° → 回到正常步态
    if (g.turnState === 'walking') {
      if (Math.abs(headingError) > TURN_THRESHOLD && speed > 0.1) {
        g.turnState = 'turning'
      }
    } else if (Math.abs(headingError) < ALIGN_THRESHOLD) {
      g.turnState = 'walking'
    }

    // 2026-09-08 turnBlend 平滑：交叉步与直行步态之间 0.25s 时间常数渐变。
    // 之前 0/1 硬切换，进出急转那一帧 hipYaw 0→0.70 / pitchAmp 0.9→0.3 瞬间跳变，
    // 髋膝肉眼可见「弹跳」。渐变后交叉步是「长出来/收回去」的。
    const targetTurnBlend = g.turnState === 'turning' ? 1 : 0
    g.turnBlend += (targetTurnBlend - g.turnBlend) * clamp(dt / 0.25, 0, 1)

    // 转向 anticipation 用：实际旋转角速度 + 当前航向偏差
    const headingChange = Math.abs(wrapAngle(g.smoothedTheta - g.prevTheta))
    g.yawVel = headingChange / Math.max(dt, 0.001)
    g.turnAmount = Math.abs(headingError)

    // 调试：每 60 帧打印一次步态核心量
    const _debugCount = (window as unknown as Record<string, number>).__g1DebugCount ?? 0
    ;(window as unknown as Record<string, number>).__g1DebugCount = _debugCount + 1
    if (_debugCount % 60 === 0) {
      console.log(
        `[g1-debug] speed=${speed.toFixed(2)} freq=${g.currentFreq.toFixed(2)} ` +
        `theta=${(g.smoothedTheta * 180 / Math.PI).toFixed(1)}° err=${(headingError * 180 / Math.PI).toFixed(1)}° ` +
        `turn=${g.turnState} pos=(${g.smoothedPos[0].toFixed(2)},${g.smoothedPos[2].toFixed(2)})`
      )
    }

    // ═══ 3. 步态相位推进（物理一致步频）═══
    // 一个相位周期 = 左右各迈一步 = 2 步，所以分母是 2×stepLength。
    // 之前用 vel/stepLength，步频快了一倍，脚在地上滑（太空步）
    g.emaFrameVel += (speed - g.emaFrameVel) * clamp(dt / 0.15, 0, 1)
    g.emaFrameVel = clamp(g.emaFrameVel, 0, 1.2)
    const walkFreq = stepFrequency(g.emaFrameVel, PARAMS.stepLength)
    // 急转（交叉步）时保底 0.4Hz 踏步节奏（按 turnBlend 渐变，不硬切）
    const baseFreq = Math.max(walkFreq, 0.4 * g.turnBlend)
    const turnBoost = clamp(g.yawVel * 0.12, 0, 0.25)
    const targetFreq = baseFreq + turnBoost

    const FIXED_DT = 1 / 60  // 固定 60Hz 步态时钟
    g.currentFreq += (targetFreq - g.currentFreq) * clamp(FIXED_DT * PARAMS.speedBlend, 0, 1)
    g.phase += g.currentFreq * FIXED_DT * 2 * Math.PI

    // idle ↔ walk 平滑过渡
    const isMoving = speed > 0.08 || g.yawVel > 0.3
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
    // G1 URDF 前向 = 局部 +X：移动方向 (cosθ, sinθ) 需 Ry(-θ)
    // （局部 +X → 世界 (cos(-θ), -sin(-θ)) = (cosθ, sinθ)，实测脚踝连线标定）
    const anchorRotY = thetaToRotY(g.smoothedTheta)
    g1Anchor.rotation.set(0, isFinite(anchorRotY) ? anchorRotY : 0, 0)
    g1Anchor.scale.set(scaleRef.current, scaleRef.current, scaleRef.current)

    // ═══ 4. 合成步态关节角（文档 §4.2 calcArmSwing + calcLegIK） ═══
    const phase = g.phase
    const blend = 1 - g.idleBlend

    // ── 速度与摆幅联动：视觉迈步距离 = 物理移动距离（脚不打滑） ──
    const TARGET_STEP_LEN = PARAMS.stepLength  // 目标单步步长 m
    // 实际单步步长 → 摆幅系数：0=静止收腿，1=满步幅
    const legAmp = legAmplitude(actualStepLength(g.emaFrameVel, g.currentFreq), TARGET_STEP_LEN)
    // 物理步幅角：asin(步长/2/腿长)。2×LEG_LEN×sin(pitch) = 视觉迈步距离 = 物理步长
    // 之前固定 0.85rad(49°)，脚甩 1.3m 但身体只走 0.45m → 太空步滑脚
    const pitchAmpBase = stridePitchAmplitude(TARGET_STEP_LEN, LEG_LEN)
    const speedFactor = clamp(g.emaFrameVel / 2.0, 0, 1)
    const armAmp = PARAMS.armSwing * (1 + speedFactor * 0.3)

    // ── 转向 anticipation（文档 §5.2：内侧腿缩短、外侧腿加长） ──
    const turnFactor = clamp(g.turnAmount / 0.6, 0, 1)  // 0 ~ 1

    // turning 状态：用侧向交叉步，hipPitch 减半、hipYaw/hipRoll 加大，
    // 让视觉上明显在原地转身，而不是前后踏步。
    // turnBlend 见上方平滑注释；转向倾向用 headingError 连续函数（饱和到 ±1），
    // 误差过零/反向时偏置连续过渡，不会像 sign() 那样瞬间翻转。
    const turnBlend = g.turnBlend
    const walkBlend = 1 - turnBlend
    const turnSign = clamp(headingError * 2, -1, 1)

    // 基础前后迈步振幅（walking 正常，turning 大幅降低）
    const pitchAmp = pitchAmpBase * legAmp * (0.9 * walkBlend + 0.3 * turnBlend)

    // 向左转（headingError > 0）→ 左腿内侧缩短，右腿外侧加长
    // 向右转相反
    const leftStride  = pitchAmp * (1 - turnFactor * 0.35 * turnSign)
    const rightStride = pitchAmp * (1 + turnFactor * 0.35 * turnSign)

    // turning 时侧向幅度加大：hipRoll 与 hipYaw 形成交叉转身
    // 直行时 hipYaw/hipRoll 接近 0（人走路腿不外八），转向才展开
    const rollAmp = legAmp * (0.10 * walkBlend + 0.55 * turnBlend)
    const yawAmp = legAmp * (0.06 * walkBlend + 0.70 * turnBlend)
    const kneeAmp = legAmp * (1.1 * walkBlend + 0.6 * turnBlend)

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
