/**
 * SceneAssets.tsx
 * 真实工业场景建模 —— 替换原来的 SlamMap 网格墙
 *
 * 风格：工业实验室 / 仓储车间
 *   - 安全围栏（perimeter fence）
 *   - 充电桩 x 2
 *   - 设备架 x 2
 *   - 地面安全标线
 *   - 天花板吊梁（顶部横条）
 *
 * 全部用 three.js 原生几何体 + MeshStandardMaterial 程序化构建，
 * 颜色从 useScenePalette 取值，深/浅主题自动同步。
 */
import * as THREE from 'three'
import type { ScenePalette } from '../hooks/useScenePalette'

interface SceneAssetsProps {
  palette: ScenePalette
}

// ─── 常量 ────────────────────────────────────────────
const FENCE_SIZE = 10 // 场地边长（米）

// ─── 充电桩 ────────────────────────────────────────────
function Charger({
  position,
  rotation = 0,
  palette,
}: {
  position: [number, number, number]
  rotation?: number
  palette: ScenePalette
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* 底座 */}
      <mesh receiveShadow position={[0, 0.025, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.4]} />
        <meshStandardMaterial color="#1a2328" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 主体立柱 */}
      <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[0.35, 1.1, 0.28]} />
        <meshStandardMaterial color="#2d3a42" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* 顶部圆角盖 */}
      <mesh castShadow position={[0, 1.18, 0]}>
        <boxGeometry args={[0.38, 0.08, 0.3]} />
        <meshStandardMaterial color="#1a2328" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* 屏幕/面板 */}
      <mesh position={[0, 0.75, 0.15]}>
        <boxGeometry args={[0.25, 0.3, 0.015]} />
        <meshStandardMaterial
          color="#0a1014"
          emissive={palette.accent}
          emissiveIntensity={0.25}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>
      {/* 状态指示灯 */}
      <mesh position={[0, 0.95, 0.155]}>
        <cylinderGeometry args={[0.018, 0.018, 0.01, 12]} />
        <meshStandardMaterial
          color={palette.accent}
          emissive={palette.accent}
          emissiveIntensity={1.5}
          metalness={0.1}
          roughness={0.4}
        />
      </mesh>
      {/* 电源线（地面到桩） */}
      <mesh position={[0.25, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>
    </group>
  )
}

// ─── 地面安全标线（黄色虚线） ──────────────────────────
function FloorMarkings({ palette }: { palette: ScenePalette }) {
  const half = FENCE_SIZE / 2

  // 高亮边框材质：用 palette.accent（租户主题色）+ emissive 保证深色可见
  const borderMat = (
    <meshStandardMaterial
      color={palette.accent}
      emissive={palette.accent}
      emissiveIntensity={0.35}
      metalness={0.2}
      roughness={0.7}
    />
  )

  return (
    <group>
      {/* ── 外框实线（一圈，代替围栏）── */}
      {/* 前边（-Z）*/}
      <mesh position={[0, 0.005, -half]}>
        <boxGeometry args={[FENCE_SIZE, 0.004, 0.06]} />
        {borderMat}
      </mesh>
      {/* 后边（+Z）*/}
      <mesh position={[0, 0.005, half]}>
        <boxGeometry args={[FENCE_SIZE, 0.004, 0.06]} />
        {borderMat}
      </mesh>
      {/* 左边（-X）*/}
      <mesh position={[-half, 0.005, 0]}>
        <boxGeometry args={[0.06, 0.004, FENCE_SIZE]} />
        {borderMat}
      </mesh>
      {/* 右边（+X）*/}
      <mesh position={[half, 0.005, 0]}>
        <boxGeometry args={[0.06, 0.004, FENCE_SIZE]} />
        {borderMat}
      </mesh>

      {/* ── 四角 L 型加强标记 ── */}
      {[
        [-half, -half],
        [half, -half],
        [-half, half],
        [half, half],
      ].map(([x, z], i) => (
        <group key={`corner-${i}`} position={[x, 0.006, z]}>
          <mesh position={[0.12 * Math.sign(x), 0, 0]}>
            <boxGeometry args={[0.24, 0.004, 0.08]} />
            {borderMat}
          </mesh>
          <mesh position={[0, 0, 0.12 * Math.sign(z)]}>
            <boxGeometry args={[0.08, 0.004, 0.24]} />
            {borderMat}
          </mesh>
        </group>
      ))}

      {/* ── 中心十字准星（G1 起点）── */}
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[0.8, 0.004, 0.06]} />
        {borderMat}
      </mesh>
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[0.06, 0.004, 0.8]} />
        {borderMat}
      </mesh>
      {/* 中心圆点 */}
      <mesh position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.14, 32]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* ── 充电桩位置地面标记 ── */}
      {[[-4.0, -4.0], [4.0, 4.0]].map(([x, z], i) => (
        <group key={`charge-${i}`} position={[x, 0.006, z]}>
          {/* 方形站位框 */}
          <mesh>
            <ringGeometry args={[0.3, 0.36, 4]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* ── 设备架位置地面标记 ── */}
      {[[-3.5, 2.5], [3.5, -2.5]].map(([x, z], i) => (
        <group key={`rack-${i}`} position={[x, 0.006, z]} rotation={[0, (i === 0 ? Math.PI / 6 : -Math.PI / 6), 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 0.6, 4]} />
            <meshBasicMaterial color="#64748b" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ─── 主组件 ────────────────────────────────────────────
export function SceneAssets({ palette }: SceneAssetsProps) {
  return (
    <group>
      <Charger position={[-4.0, 0, -4.0]} rotation={Math.PI / 4} palette={palette} />
      <Charger position={[4.0, 0, 4.0]} rotation={-Math.PI * 3 / 4} palette={palette} />
      <FloorMarkings palette={palette} />
    </group>
  )
}
