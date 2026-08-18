import { RoundedBox } from '@react-three/drei'

interface G1DogProps {
  position: [number, number, number]
  rotation: [number, number, number]
  joints?: Record<string, number>
  scale?: number
}

// 宇树 G1 四足占位（真模型替换只需在此挂 useGLTF + Suspense）
export function G1Dog({ position, rotation, scale = 0.5 }: G1DogProps) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* 机身 */}
      <RoundedBox args={[0.7, 0.28, 1.0]} radius={0.08} smoothness={4} position={[0, 0.42, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e6edf7" metalness={0.55} roughness={0.32} />
      </RoundedBox>
      {/* 腰部灯带 */}
      <mesh position={[0, 0.43, 0]}>
        <boxGeometry args={[0.72, 0.05, 0.5]} />
        <meshStandardMaterial color="#1890ff" emissive="#1890ff" emissiveIntensity={0.6} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* 传感器头部 */}
      <RoundedBox args={[0.24, 0.18, 0.24]} radius={0.06} smoothness={4} position={[0, 0.52, 0.52]} castShadow>
        <meshStandardMaterial color="#101725" metalness={0.6} roughness={0.3} emissive="#3ba0ff" emissiveIntensity={0.5} />
      </RoundedBox>
      {/* 4 条腿 */}
      {([
        [-0.24, 0.26],
        [0.24, 0.26],
        [-0.24, -0.26],
        [0.24, -0.26],
      ] as const).map(([lx, lz], i) => (
        <group key={i} position={[lx, 0.3, lz]}>
          <mesh castShadow position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.05, 0.045, 0.34]} />
            <meshStandardMaterial color="#2b3a5a" metalness={0.55} roughness={0.38} />
          </mesh>
          {/* 脚端球 */}
          <mesh castShadow position={[0, -0.31, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#0c1322" metalness={0.3} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
