interface FloorProps {
  color?: string
}

/** 金属感地面 —— 颜色随主题（深色深绿灰 / 浅色浅白灰）自动切换 */
export function Floor({ color }: FloorProps = {}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial
        color={color ?? '#121916'}
        roughness={0.65}
        metalness={0.15}
      />
    </mesh>
  )
}
