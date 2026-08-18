import { RoundedBox } from '@react-three/drei'

interface PeanutBotProps {
  position: [number, number, number]
  rotation: [number, number, number]
}

// 擎朗 Peanut 送餐机占位（双层托盘 + 屏幕头，真模型替换只需换 GLTF）
export function PeanutBot({ position, rotation }: PeanutBotProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* 底盘 */}
      <RoundedBox args={[0.6, 0.3, 0.5]} radius={0.08} smoothness={4} position={[0, 0.22, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#ff7a18" metalness={0.45} roughness={0.32} />
      </RoundedBox>
      {/* 下托盘 */}
      <RoundedBox args={[0.68, 0.06, 0.58]} radius={0.03} smoothness={4} position={[0, 0.42, 0]} castShadow>
        <meshStandardMaterial color="#fff3e0" metalness={0.1} roughness={0.5} />
      </RoundedBox>
      {/* 立柱 */}
      <RoundedBox args={[0.14, 0.5, 0.14]} radius={0.04} smoothness={4} position={[0, 0.7, 0]} castShadow>
        <meshStandardMaterial color="#ff7a18" metalness={0.45} roughness={0.38} />
      </RoundedBox>
      {/* 上托盘 */}
      <RoundedBox args={[0.68, 0.06, 0.58]} radius={0.03} smoothness={4} position={[0, 0.99, 0]} castShadow>
        <meshStandardMaterial color="#fff3e0" metalness={0.1} roughness={0.5} />
      </RoundedBox>
      {/* 头部屏幕 */}
      <RoundedBox args={[0.28, 0.24, 0.13]} radius={0.06} smoothness={4} position={[0, 1.24, 0]} castShadow>
        <meshStandardMaterial color="#101725" metalness={0.6} roughness={0.3} emissive="#1890ff" emissiveIntensity={0.55} />
      </RoundedBox>
      {/* 导航灯 */}
      <mesh position={[0, 0.4, 0.3]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#ffe082" emissive="#ffd54f" emissiveIntensity={1.4} />
      </mesh>
    </group>
  )
}
