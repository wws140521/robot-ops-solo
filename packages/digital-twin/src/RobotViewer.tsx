import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, ContactShadows, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import { memo, useRef, useState, useEffect } from 'react'
import { G1Humanoid } from './robots/G1Humanoid'
import { PeanutBot } from './robots/PeanutBot'
import { FanucArm } from './robots/FanucArm'
import { KukaArm } from './robots/KukaArm'
import { IndustrialRobotModel } from './robots/IndustrialRobotModel'
import { Floor, ConcreteFloor } from './environment/Floor'
import { isIndustrialBrand } from './config/industrial-models'

import { useScenePalette } from './hooks/useScenePalette'
import type { UnifiedRobotState, JointTelemetry } from 'robot-adapter-kit'

interface RobotViewerProps {
  robotId: string
  state?: UnifiedRobotState
  // 2026-09-09 showMap 废弃：场景道具（充电桩/安全标线）已按「地面得有、其他东西不能有」统一撤掉
  /** @deprecated 2026-09-09 场景道具已移除，此参数不再生效 */
  showMap?: boolean
  // 告警→3D 联动：故障关节号（工业臂 J1~J6），传入后该关节红色脉冲闪烁
  faultJoint?: number | null
}

// 调试桥：把当前 R3F scene 挂到 window.__twinScene，
// 供浏览器 evaluate_script 检查场景内容（mesh 清单/道具残留排查）
export function SceneDebugBridge() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__twinScene = scene
    return () => {
      delete (window as unknown as Record<string, unknown>).__twinScene
    }
  }, [scene])
  return null
}

export function RobotViewer({ state, faultJoint = null }: RobotViewerProps) {
  const palette = useScenePalette()

  // 用 ref 缓存最新 state，防止短暂 falsy 导致 RobotBody 卸载
  // WS 重连、碰撞检测、电量临界时 state 可能变成 undefined/null，
  // 这时候用上一个有效状态继续渲染，不然机器人会闪成蓝色 wireframe，贼丑
  const lastValidStateRef = useRef<UnifiedRobotState | undefined>(state)
  if (state) lastValidStateRef.current = state
  const effectiveState = state ?? lastValidStateRef.current

  // 一旦有过有效 state 就保持组件挂载，
  // 后面 state 再来回变也不会卸载，避免 three-urdf mesh 状态丢失
  const hasEverHadStateRef = useRef(false)
  if (effectiveState) hasEverHadStateRef.current = true
  const shouldRenderRobot = effectiveState || hasEverHadStateRef.current

  // 工业设备用车间场景（混凝土地坪），商用设备维持光洁地面 + 细网格
  const industrial = isIndustrialBrand(effectiveState?.brand)
  // 2026-09-09 各场景统一「地面得有、其他东西不能有」：
  // 地面（光洁地面/细网格 或 混凝土地坪）保留，充电桩、安全标线、工业基座等道具全部撤掉

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 10,
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${palette.bgTop} 0%, ${palette.bgBottom} 100%)`,
      }}
    >
      {/* {effectiveState && <StatusBadge state={effectiveState} collision={collision} cellType={cellType} />} */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [5.5, 4.5, 6.5], fov: 42 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[palette.bgBottom]} />
        <fog attach="fog" args={[palette.fog, 14, 32]} />

        <SceneDebugBridge />

        {/* 2026-08-28 静态场景元素 memo 化：灯光/地面/网格/阴影/墙体仅依赖 palette+showMap，
            避免 WS 高频帧（~10Hz）触发重建导致网格几何重绘闪烁 */}
        <SceneEnvironment palette={palette} industrial={industrial} />

        {/* 机器人 —— 始终挂载，G1Model 内部用 useRef 管理加载状态，不会因短暂 falsy 卸载 */}
        {shouldRenderRobot && (
          <RobotBody
            state={effectiveState ?? lastValidStateRef.current!}
            visible={!!effectiveState}
            faultJoint={faultJoint}
          />
        )}

        {/* {effectiveState && <HUDLabel
          position={[effectiveState.position.x, 2.0, effectiveState.position.y]}
          robot={effectiveState}
          accentColor={palette.accent}
          primaryColor={palette.primary}
        />} */}
        {/* 轨迹线关闭 */}
        {/* {trajectory && trajectory.length > 1 && <GlowTrajectory points={trajectory} color={palette.accent} />} */}
        {/* {effectiveState && <GroundRing position={[effectiveState.position.x, 0, effectiveState.position.y]} color={palette.accent} />} */}

        <OrbitControls
          makeDefault
          enableDamping
          target={[0, 0.6, 0]}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={2}
          maxDistance={18}
        />

        {/* 2026-08-28 性能降级：低配设备自动降低像素比 + 减少事件监听 */}
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
      </Canvas>
    </div>
  )
}

// 2026-08-28 提取静态场景为独立 memo 组件：
// - 移除 infiniteGrid（drei 无限网格 shader 随相机每帧重算，拖拽时视觉抖动）
// - Grid 抬升 y=0.005 避免与 Floor(y=0) z-fighting
// - 降低线宽减少深度缓冲竞争
// - memo 包裹避免 WS 帧触发重建
// 2026-09-07 导出给 FleetViewer（舰队全景）复用同一套灯光/地面/阴影
export const SceneEnvironment = memo(function SceneEnvironment({
  palette,
  industrial,
}: {
  palette: ReturnType<typeof useScenePalette>
  industrial: boolean
}) {
  return (
    <>
      {/* 2026-08-28: 移除 Environment preset="warehouse" — 依赖外部 CDN (githack.com)，
          在受限网络环境下超时导致 Canvas 崩溃。改用增强型多光源方案替代 IBL。*/}
      <ambientLight intensity={0.7} color="#e8edf5" />

      <directionalLight
        position={[6, 10, 6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
        color="#ffffff"
      />

      <pointLight
        position={[-5, 3, -3]}
        intensity={0.6}
        color={palette.accent}
        distance={14}
        decay={2}
      />
      <pointLight
        position={[4, 2, 4]}
        intensity={0.5}
        color={palette.primary}
        distance={12}
        decay={2}
      />

      {/* 地面：工业设备铺混凝土地坪（自带伸缩缝网格），
          商用设备保持光洁地面 + 细网格。
          2026-09-09 撤掉充电桩/安全标线等所有场景道具，只留地面本身 */}
      {industrial ? (
        <ConcreteFloor palette={palette} />
      ) : (
        <>
          {/* 2026-08-28 Floor 升级 MeshReflectorMaterial，反射强度 1.2 提供金属质感 */}
          <Floor color={palette.floor} reflectivity={0} />

          {/* 2026-08-28 Grid 抬升 0.005 + 移除 infiniteGrid + 降低线宽 → 消除鼠标拖拽时网格闪烁 */}
          <group position={[0, 0.005, 0]}>
            <Grid
              args={[28, 28]}
              cellSize={0.5}
              cellThickness={0.08}
              cellColor={palette.gridCell}
              sectionSize={2}
              sectionThickness={0.15}
              sectionColor={palette.gridSection}
              fadeDistance={24}
              fadeStrength={1.5}
              infiniteGrid={false}
            />
          </group>
        </>
      )}

      <ContactShadows
        position={[0, 0.012, 0]}
        opacity={0.2}
        scale={18}
        blur={2.4}
        far={6}
        resolution={512}
        color={palette.shadow}
      />
    </>
  )
})

function RobotBody({ state, visible = true, faultJoint = null }: { state: UnifiedRobotState; visible?: boolean; faultJoint?: number | null }) {
  // 工业臂的 state.position 是 TCP 末端位姿（毫米级，±500 范围），
  // 不是基座世界坐标——拿来摆放模型会直接飞出相机视野，所以固定放原点。
  // 2026-09-09 基座撤掉后直接落地（y=0），基面落在混凝土地坪上
  const industrial = isIndustrialBrand(state.brand)
  const pos: [number, number, number] = industrial
    ? [0, 0, 0]
    : [state.position.x, 0, state.position.y]
  const rot: [number, number, number] = industrial
    ? [0, 0, 0]
    : [0, state.position.theta, 0]
  const [urdfFailed, setUrdfFailed] = useState(false)

  // 切换品牌时重置 urdfFailed，不然上一台加载失败的状态会残留到下一台
  useEffect(() => {
    setUrdfFailed(false)
  }, [state.brand])

  // 工业关节遥测，统一从 state.industrial?.joints 读取
  const industrialJoints = state.industrial?.joints ?? []

  return (
    <group visible={visible}>
      {state.brand === 'unitree' && <G1Humanoid position={pos} rotation={rot} scale={1.0} />}
      {state.brand === 'keenon' && <PeanutBot position={pos} rotation={rot} />}

      {isIndustrialBrand(state.brand) && !urdfFailed && (
        <IndustrialRobotModel
          brand={state.brand}
          position={pos}
          rotation={rot}
          joints={industrialJoints}
          visible={visible}
          faultJoint={faultJoint}
          onLoadError={(err) => {
            console.warn(`[RobotViewer] ${state.brand} 真实模型加载失败，降级到程序化机械臂:`, err.message)
            setUrdfFailed(true)
          }}
        />
      )}

      {isIndustrialBrand(state.brand) && urdfFailed && (
        <FallbackIndustrialArm brand={state.brand} position={pos} rotation={rot} joints={industrialJoints} />
      )}
    </group>
  )
}

// URDF 缺失或损坏时，用原来的程序化机械臂兜底
function FallbackIndustrialArm({
  brand,
  position,
  rotation,
  joints,
}: {
  brand: 'FANUC' | 'KUKA' | 'ESTUN' | 'YASKAWA'
  position: [number, number, number]
  rotation: [number, number, number]
  joints: JointTelemetry[]
}) {
  return (
    <group position={position} rotation={rotation}>
      {brand === 'FANUC' && <FanucArm joints={joints} />}
      {brand === 'KUKA' && <KukaArm joints={joints} />}
      {(brand === 'ESTUN' || brand === 'YASKAWA') && <FanucArm joints={joints} />}
    </group>
  )
}