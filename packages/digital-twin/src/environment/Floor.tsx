// 浅色微金属反射地板
export function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#e2e8f0" roughness={0.65} metalness={0.15} />
    </mesh>
  )
}
