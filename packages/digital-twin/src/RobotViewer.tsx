import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, ContactShadows, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import { memo, Suspense, useRef } from 'react'
import * as THREE from 'three'
import { G1Dog } from './robots/G1Dog'
import { PeanutBot } from './robots/PeanutBot'
import { Floor } from './environment/Floor'
import { SlamMap } from './environment/SlamMap'
import { isObstacle, getCellType, type CellType } from './environment/collision'
import { GlowTrajectory } from './overlays/GlowTrajectory'
import { StatusBadge } from './overlays/StatusBadge'
import { HUDLabel } from './overlays/HUDLabel'
import { useScenePalette } from './hooks/useScenePalette'
import type { UnifiedRobotState } from 'robot-adapter-kit'

interface RobotViewerProps {
  robotId: string
  state?: UnifiedRobotState
  trajectory?: { x: number; y: number }[]
  showMap?: boolean
}

export function RobotViewer({ robotId, state, trajectory, showMap = true }: RobotViewerProps) {
  const palette = useScenePalette()
  const collision = state ? isObstacle(state.position.x, state.position.y) : false
  const cellType: CellType | null = state ? getCellType(state.position.x, state.position.y) : null

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
      {state && <StatusBadge state={state} collision={collision} cellType={cellType} />}
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

        {/* 2026-08-28 Suspense 包裹机器人 —— 为后续接入 useGLTF/URDF 异步加载预留兜底 */}
        <Suspense fallback={null}>
          {state && <RobotBody state={state} collision={collision} />}
        </Suspense>

        {state && <HUDLabel
          position={[state.position.x, 2.0, state.position.y]}
          robot={state}
          accentColor={palette.accent}
          primaryColor={palette.primary}
        />}
        {trajectory && trajectory.length > 1 && <GlowTrajectory points={trajectory} color={palette.accent} />}
        {state && <GroundRing position={[state.position.x, 0, state.position.y]} color={palette.accent} />}

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
      <ambientLight intensity={0.75} color="#ffffff" />

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
      <Floor color={palette.floor} reflectivity={1.2} />

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
        <SlamMap
          wallPerimColor={palette.wallPerim}
          wallInnerColor={palette.wallInner}
          wallPerimEmissive={palette.wallPerimEmissive}
          wallInnerEmissive={palette.wallInnerEmissive}
        />
      )}

      <ContactShadows
        position={[0, 0.012, 0]}
        opacity={0.25}
        scale={18}
        blur={2.4}
        far={6}
        resolution={1024}
        color={palette.shadow}
      />
    </>
  )
})

function RobotBody({ state, collision }: { state: UnifiedRobotState; collision: boolean }) {
  const pos: [number, number, number] = [state.position.x, 0, state.position.y]
  const rot: [number, number, number] = [0, state.position.theta, 0]

  return (
    <>
      {state.brand === 'unitree' && <G1Dog position={pos} rotation={rot} joints={state.joints} />}
      {state.brand === 'keenon' && <PeanutBot position={pos} rotation={rot} />}
      {collision && <CollisionRing position={pos} />}
    </>
  )
}

function CollisionRing({ position }: { position: [number, number, number] }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((s) => {
    if (matRef.current) {
      matRef.current.opacity = 0.4 + 0.45 * Math.sin(s.clock.elapsedTime * 6)
    }
  })
  return (
    <mesh position={[position[0], 0.03, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.62, 36]} />
      <meshBasicMaterial ref={matRef} color="#ff1744" transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  )
}

function GroundRing({
  position,
  color = '#4a9eff',
}: {
  position: [number, number, number]
  color?: string
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((s) => {
    if (matRef.current) {
      matRef.current.opacity = 0.25 + 0.2 * Math.sin(s.clock.elapsedTime * 2)
    }
  })
  return (
    <mesh position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.7, 0.85, 48]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
  )
}