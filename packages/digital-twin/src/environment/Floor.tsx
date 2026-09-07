import { Grid, MeshReflectorMaterial } from '@react-three/drei'
import type { ScenePalette } from '../hooks/useScenePalette'

interface FloorProps {
  color?: string
  // 反射强度，0 就是哑光，2 很镜面，默认 1.2 差不多
  reflectivity?: number
}

// 粗略判断一个 hex 颜色亮不亮（感知亮度 > 128 算亮色）
// 混凝土构件用这个自适应深浅主题：深主题配深灰，浅主题配水泥本色
export function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 128
}

// 金属感地面，用 drei 的 MeshReflectorMaterial 做实时反射
// 颜色跟着主题走：深主题深绿灰，浅主题浅白灰
// reflectivity 为 0 时直接退回哑光材质，省点性能
export function Floor({ color, reflectivity = 1.2 }: FloorProps = {}) {
  const baseColor = color ?? '#121916'
  const isMatte = reflectivity <= 0

  if (isMatte) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={baseColor} roughness={0.65} metalness={0.15} />
      </mesh>
    )
  }

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={reflectivity * 0.5}
        roughness={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color={baseColor}
        metalness={0.5}
        mirror={0.2}
      />
    </mesh>
  )
}

// 混凝土工厂地坪：哑光水泥面 + 大间距伸缩缝
// 工业机械臂专用，和商用人形/配送机器人的光洁地面区分开
// 水泥灰跟着主题深浅走，靠 palette.floor 的亮度判断当前是深色还是浅色主题
export function ConcreteFloor({ palette }: { palette: ScenePalette }) {
  const light = isLightColor(palette.floor)
  // 深主题：深灰水泥；浅主题：水泥本色偏暖灰
  const tones = light
    ? { floor: '#b6b1a6', joint: '#a09b8f', section: '#8f8a7e' }
    : { floor: '#3d4147', joint: '#2c2f34', section: '#1f2226' }

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={tones.floor} roughness={0.95} metalness={0} />
      </mesh>
      {/* 伸缩缝：混凝土分块浇筑留下的缝，2m 一块、8m 一条深缝 */}
      <group position={[0, 0.005, 0]}>
        <Grid
          args={[28, 28]}
          cellSize={2}
          cellThickness={0.12}
          cellColor={tones.joint}
          sectionSize={8}
          sectionThickness={0.2}
          sectionColor={tones.section}
          fadeDistance={24}
          fadeStrength={1.2}
          infiniteGrid={false}
        />
      </group>
    </>
  )
}
