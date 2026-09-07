// 工业机械臂的安装基础：混凝土基墩 + 钢底板 + 四颗地脚螺栓
// 真实工厂里机械臂就是这么装的：先浇混凝土墩，再放钢底板，锚栓打环氧灌进去
// 机器人本体由 RobotBody 抬到 PEDESTAL_HEIGHT，正好落在钢底板顶面上
import { useScenePalette } from '../hooks/useScenePalette'
import { isLightColor } from './Floor'

// 基墩 0.25 + 钢板 0.04，机器人基座原点落在这里
export const PEDESTAL_HEIGHT = 0.29

// 螺栓中心到钢板中心线的距离（正方形四角分布）
const BOLT_OFFSET = 0.31

export function IndustrialPedestal() {
  const palette = useScenePalette()
  const light = isLightColor(palette.floor)

  // 深浅主题各一套：深主题偏冷灰，浅主题水泥本色 + 铸铁钢板
  const concrete = light ? '#c4bfb4' : '#4a4e54'
  const steel = light ? '#7a7f85' : '#2b2f33'
  const bolt = light ? '#5d636a' : '#9aa1a8'

  return (
    <group>
      {/* 混凝土基墩：比钢板大一圈，露出浇筑边 */}
      <mesh castShadow receiveShadow position={[0, 0.125, 0]}>
        <boxGeometry args={[0.8, 0.25, 0.8]} />
        <meshStandardMaterial color={concrete} roughness={0.95} metalness={0} />
      </mesh>

      {/* 钢底板：机械臂法兰直接拧在上面 */}
      <mesh castShadow receiveShadow position={[0, 0.27, 0]}>
        <boxGeometry args={[0.72, 0.04, 0.72]} />
        <meshStandardMaterial color={steel} roughness={0.35} metalness={0.85} />
      </mesh>

      {/* 四颗地脚螺栓：六角头，radialSegments=6 天然就是六棱柱 */}
      {[
        [BOLT_OFFSET, BOLT_OFFSET],
        [BOLT_OFFSET, -BOLT_OFFSET],
        [-BOLT_OFFSET, BOLT_OFFSET],
        [-BOLT_OFFSET, -BOLT_OFFSET],
      ].map(([x, z], i) => (
        <mesh key={`bolt-${i}`} castShadow position={[x, PEDESTAL_HEIGHT + 0.02, z]}>
          <cylinderGeometry args={[0.02, 0.02, 0.04, 6]} />
          <meshStandardMaterial color={bolt} roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
