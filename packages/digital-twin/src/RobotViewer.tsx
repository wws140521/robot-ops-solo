import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, ContactShadows, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import { memo, useRef } from 'react'
import { G1Humanoid } from './robots/G1Humanoid'
import { PeanutBot } from './robots/PeanutBot'
import { Floor } from './environment/Floor'
import { SceneAssets } from './environment/SceneAssets'

import { useScenePalette } from './hooks/useScenePalette'
import type { UnifiedRobotState } from 'robot-adapter-kit'

interface RobotViewerProps {
  robotId: string
  state?: UnifiedRobotState
  showMap?: boolean
}

export function RobotViewer({ state, showMap = true }: RobotViewerProps) {
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

        {/* 2026-08-28 静态场景元素 memo 化：灯光/地面/网格/阴影/墙体仅依赖 palette+showMap，
            避免 WS 高频帧（~10Hz）触发重建导致网格几何重绘闪烁 */}
        <SceneEnvironment palette={palette} showMap={showMap} />

        {/* 机器人 —— 始终挂载，G1Model 内部用 useRef 管理加载状态，不会因短暂 falsy 卸载 */}
        {shouldRenderRobot && (
          <RobotBody
            state={effectiveState ?? lastValidStateRef.current!}
            visible={!!effectiveState}
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
const SceneEnvironment = memo(function SceneEnvironment({
  palette,
  showMap,
}: {
  palette: ReturnType<typeof useScenePalette>
  showMap: boolean
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

      {showMap && (
        <SceneAssets palette={palette} />
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

function RobotBody({ state, visible = true }: { state: UnifiedRobotState; visible?: boolean }) {
  const pos: [number, number, number] = [state.position.x, 0, state.position.y]
  const rot: [number, number, number] = [0, state.position.theta, 0]

  return (
    <group visible={visible}>
      {state.brand === 'unitree' && <G1Humanoid position={pos} rotation={rot} scale={1.0} />}
      {state.brand === 'keenon' && <PeanutBot position={pos} rotation={rot} />}
    </group>
  )
}