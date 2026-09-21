// FleetViewer.tsx
// 舰队全景：一个 Canvas 同屏渲染全部机器人（G1 人形 + Peanut 配送 + 4 品牌工业臂）
// 商用机器人用真实遥测坐标在巡逻区走动，工业臂在北侧一字排开组成产线
// 2026-09-09 场景统一「地面得有、其他东西不能有」：充电桩/安全标线/基座等道具全部撤掉
// 交互：单击机器人 → 相机飞行聚焦；再次单击同一台 → 进入单机视图；「返回全景」回到俯瞰
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import { useState, useCallback, useRef, useEffect, memo } from 'react'
import * as THREE from 'three'
import type { UnifiedRobotState } from 'robot-adapter-kit'
import { G1Humanoid } from './robots/G1Humanoid'
import { PeanutBot } from './robots/PeanutBot'
import { IndustrialRobotModel } from './robots/IndustrialRobotModel'
import { SceneEnvironment, SceneDebugBridge } from './RobotViewer'
import { HUDLabel } from './overlays/HUDLabel'
import { useScenePalette } from './hooks/useScenePalette'
import { isIndustrialBrand, type IndustrialBrand } from './config/industrial-models'

// 工业臂产线槽位：巡逻区（|z|≤2.5）外一字排开，间距 3m
const INDUSTRIAL_SLOTS: Record<string, [number, number]> = {
  FANUC: [-4.5, -3.6],
  KUKA: [-1.5, -3.6],
  ESTUN: [1.5, -3.6],
  YASKAWA: [4.5, -3.6],
}

// 全景机位：斜俯瞰，巡逻区在前景、工业产线在纵深
const OVERVIEW_CAM: [number, number, number] = [0.5, 8.5, 10.5]
const OVERVIEW_TARGET: [number, number, number] = [0, 0.4, -1.2]
// 聚焦机位：相机落在机器人侧前方，绕 45° 看过去
const FOCUS_OFFSET: [number, number, number] = [2.8, 2.0, 3.4]

// 相机飞行任务：飞到指定机位（指数阻尼插值，不是线性硬切）
interface Flight {
  camPos: THREE.Vector3
  target: THREE.Vector3
}

interface FleetViewerProps {
  robots: UnifiedRobotState[]
  // 聚焦状态下再次单击同一台机器人时触发（由上层跳转单机视图）
  onSelect?: (robotId: string) => void
  // 自动聚焦的机器人 ID（一键演示 / 告警联动：跳转进来时相机飞过去）
  // 值变化且非空时触发一次聚焦，不影响手动点击聚焦
  autoFocusRobotId?: string | null
  // 自动聚焦序号：变化即重新触发一次相机飞行（同一机器人重复点击告警也能重飞）
  autoFocusSeq?: number
  // 告警→3D 联动：故障机器人 + 关节号，目标机器人脚下红色脉冲光环、故障关节闪烁
  faultInfo?: { robotId: string; joint: number | null } | null
}

// 取机器人在舰队里的摆放坐标（工业臂用固定槽位，商用机器人用遥测坐标）
// 2026-09-09 基座撤掉后工业臂直接落地（y=0），基面落在混凝土地坪上
function fleetPos(robot: UnifiedRobotState): [number, number, number] {
  if (isIndustrialBrand(robot.brand)) {
    const slot = INDUSTRIAL_SLOTS[robot.brand] ?? [0, -3.6]
    return [slot[0], 0, slot[1]]
  }
  return [robot.position.x, 0, robot.position.y]
}

// 相机飞行控制：flight 存在时逐帧阻尼逼近目标机位，到位后回调清除
function CameraRig({ flight, onArrived }: { flight: Flight | null; onArrived: () => void }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void; enabled: boolean }
    | null
  const initializedRef = useRef(false)

  // 初始 target 对准产线方向（OrbitControls 默认盯原点，全景构图会偏）
  useEffect(() => {
    if (!initializedRef.current && controls?.target) {
      controls.target.set(...OVERVIEW_TARGET)
      controls.update()
      initializedRef.current = true
    }
  }, [controls])

  // 飞行期间锁轨道控制，避免用户输入和插值互相打架
  useEffect(() => {
    if (controls) controls.enabled = !flight
  }, [flight, controls])

  useFrame((_, delta) => {
    if (!flight) return
    const k = 1 - Math.exp(-delta / 0.5)
    camera.position.lerp(flight.camPos, k)
    if (controls?.target) {
      controls.target.lerp(flight.target, k)
      controls.update()
    }
    if (camera.position.distanceTo(flight.camPos) < 0.1) onArrived()
  })
  return null
}

// 单台机器人在舰队里的呈现：模型 + 点击热区 + HUD 标签 + 聚焦光环
// 2026-09-09 memo：TwinPage 舰队模式下 robots 引用每帧变（6 台轮着来），
// 但单台机器人的 state 引用只在它自己的遥测到达时才换——memo 后未更新的台次
// 整棵子树（模型 + HUD DOM + 热区）跳过 reconcile，每帧实际重渲染 6 → 1~2 台。
// onClick 是 useCallback、focused/alertFocus/faultJoint 是原始值，memo 生效条件天然满足。
const FleetRobot = memo(function FleetRobot({
  robot,
  focused,
  alertFocus = false,
  faultJoint = null,
  onClick,
}: {
  robot: UnifiedRobotState
  focused: boolean
  // 告警联动目标：脚下光环换成红色脉冲（区别于手动聚焦的主题色光环）
  alertFocus?: boolean
  // 故障关节号（告警联动），工业臂该关节红色脉冲闪烁
  faultJoint?: number | null
  onClick: (robot: UnifiedRobotState) => void
}) {
  const palette = useScenePalette()
  const industrial = isIndustrialBrand(robot.brand)
  const [x, y, z] = fleetPos(robot)
  const rot: [number, number, number] = industrial ? [0, 0, 0] : [0, robot.position.theta, 0]

  // 热区尺寸按机型定：工业臂罩住整臂，人形罩住躯干
  const hitR = industrial ? 1.15 : robot.brand === 'unitree' ? 0.65 : 0.5
  const hitH = industrial ? 2.4 : robot.brand === 'unitree' ? 1.8 : 1.4
  // 2026-09-09 G1 标签从 1.7 抬到 2.0：G1 站高 1.332m + 头部 mesh 顶 ~1.4m，
  // 原 1.7m 只留 30cm 间隙，卡片有 4 行文本高度，低机位看会压到脸。
  // 2.0m 留 60cm+ 缓冲；Peanut 标签 1.55 不动（其头顶屏 ~1.36m，间距已够）。
  // 2026-09-09 二次上调（用户观感反馈）：G1 2.0→2.25，Peanut 1.55→1.85，
  // 与卡片放大后的尺寸保持同样的视觉余量。
  const labelY = industrial ? 2.6 : 3

  // 告警光环脉冲：透明度按 sin 波动，和故障关节闪烁同一个节奏语言
  const alertRingMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  useFrame(({ clock }) => {
    if (alertRingMatRef.current) {
      alertRingMatRef.current.opacity = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 7))
    }
  })

  return (
    <group>
      {/* 模型本体：商用机器人按遥测坐标走动，工业臂站桩 */}
      {robot.brand === 'unitree' && <G1Humanoid position={[x, y, z]} rotation={rot} scale={1.0} />}
      {robot.brand === 'keenon' && <PeanutBot position={[x, y, z]} rotation={rot} />}
      {industrial && (
        <IndustrialRobotModel
          brand={robot.brand as IndustrialBrand}
          position={[x, y, z]}
          rotation={rot}
          joints={robot.industrial?.joints ?? []}
          isolate={false}
          faultJoint={faultJoint}
        />
      )}

      {/* 聚焦光环：脚下亮一圈，标出当前聚焦对象；告警联动时红色脉冲 */}
      {(focused || alertFocus) && (
        <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[hitR + 0.18, hitR + 0.32, 48]} />
          <meshBasicMaterial
            ref={alertRingMatRef}
            color={alertFocus ? 0xff3d71 : palette.accent}
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* 点击热区：透明圆柱罩住机器人，事件只吃这一层 */}
      <mesh
        position={[x, hitH / 2, z]}
        onClick={(e) => {
          e.stopPropagation()
          onClick(robot)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <cylinderGeometry args={[hitR, hitR, hitH, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* HUD 标签：ID/品牌/状态/电量 */}
      <HUDLabel
        position={[x, labelY, z]}
        robot={robot}
        accentColor={palette.accent}
        primaryColor={palette.primary}
      />
    </group>
  )
})

export function FleetViewer({
  robots,
  onSelect,
  autoFocusRobotId,
  autoFocusSeq = 0,
  faultInfo,
}: FleetViewerProps) {
  const palette = useScenePalette()
  const [flight, setFlight] = useState<Flight | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  // robots 每帧都在变（WS 遥测），自动聚焦效果只依赖 autoFocusRobotId，用 ref 拿最新列表
  const robotsRef = useRef(robots)
  robotsRef.current = robots

  // 自动聚焦：一键演示启动 / 告警联动跳转时相机飞到目标机器人
  // seq 变化也触发（同一台机器人重复点击告警条目时重新飞一次）
  useEffect(() => {
    if (!autoFocusRobotId) return
    const robot = robotsRef.current.find((r) => r.robotId === autoFocusRobotId)
    if (!robot) return
    setFocusedId(robot.robotId)
    const [x, , z] = fleetPos(robot)
    setFlight({
      camPos: new THREE.Vector3(x + FOCUS_OFFSET[0], FOCUS_OFFSET[1], z + FOCUS_OFFSET[2]),
      target: new THREE.Vector3(x, 1.0, z),
    })
  }, [autoFocusRobotId, autoFocusSeq])

  const online = robots.filter((r) => r.online).length

  // 单击聚焦；聚焦状态下再点同一台 → 交给上层进单机视图
  const handleClick = useCallback(
    (robot: UnifiedRobotState) => {
      if (focusedId === robot.robotId) {
        onSelect?.(robot.robotId)
        return
      }
      setFocusedId(robot.robotId)
      const [x, , z] = fleetPos(robot)
      const industrial = isIndustrialBrand(robot.brand)
      setFlight({
        camPos: new THREE.Vector3(x + FOCUS_OFFSET[0], FOCUS_OFFSET[1], z + FOCUS_OFFSET[2]),
        target: new THREE.Vector3(x, industrial ? 1.0 : 0.8, z),
      })
    },
    [focusedId, onSelect],
  )

  // 回全景：飞回俯瞰机位并清掉聚焦态
  const backToOverview = useCallback(() => {
    setFocusedId(null)
    setFlight({
      camPos: new THREE.Vector3(...OVERVIEW_CAM),
      target: new THREE.Vector3(...OVERVIEW_TARGET),
    })
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${palette.bgTop} 0%, ${palette.bgBottom} 100%)`,
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: OVERVIEW_CAM, fov: 46 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[palette.bgBottom]} />
        {/* 全景视野更大，雾比单机视图推远一截，不然产线被雾吃掉 */}
        <fog attach="fog" args={[palette.fog, 20, 44]} />

        <SceneDebugBridge />

        <SceneEnvironment palette={palette} industrial={false} />

        {robots.map((robot) => (
          <FleetRobot
            key={robot.robotId}
            robot={robot}
            focused={focusedId === robot.robotId}
            alertFocus={faultInfo?.robotId === robot.robotId}
            faultJoint={faultInfo?.robotId === robot.robotId ? (faultInfo.joint ?? null) : null}
            onClick={handleClick}
          />
        ))}

        <OrbitControls
          makeDefault
          enableDamping
          target={OVERVIEW_TARGET}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={2}
          maxDistance={26}
          onStart={() => setFlight(null)}
        />

        <CameraRig flight={flight} onArrived={() => setFlight(null)} />

        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
      </Canvas>

      {/* 左上角舰队统计卡 */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, pointerEvents: 'none' }}>
        <div className="card hud-corners" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.15em', marginBottom: 6 }}>
            FLEET VIEW
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--primary)',
              textShadow: 'var(--glow-primary)',
            }}
          >
            舰队全景
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span className={online > 0 ? 'dot dot-online' : 'dot dot-offline'} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {robots.length} 台设备 · {online} 在线
            </span>
          </div>
        </div>
      </div>

      {/* 底部操作提示 + 返回全景按钮 */}
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            background: 'var(--bg-glass)',
            padding: '6px 14px',
            borderRadius: 20,
            border: '1px solid var(--border-subtle)',
          }}
        >
          单击聚焦 · 再次单击进入单机视图 · 拖拽旋转
        </span>
        {focusedId && (
          <button className="btn" onClick={backToOverview} style={{ pointerEvents: 'auto' }}>
            返回全景
          </button>
        )}
      </div>
    </div>
  )
}
