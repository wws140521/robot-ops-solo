import { MeshReflectorMaterial } from '@react-three/drei'

interface FloorProps {
  color?: string
  /** 反射强度（0 = 无反射，2 = 强反射） */
  reflectivity?: number
}

/**
 * 金属感地面
 * —— 使用 drei MeshReflectorMaterial 实现实时反射/镜像效果
 * —— 颜色随主题（深色深绿灰 / 浅色浅白灰）自动切换
 * —— 反射强度可通过 reflectivity 调整，0 时退回哑光
 */
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
        mixStrength={reflectivity}
        roughness={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color={baseColor}
        metalness={0.5}
        mirror={0.5}
      />
    </mesh>
  )
}
