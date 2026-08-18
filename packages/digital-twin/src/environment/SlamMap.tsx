import { useMemo } from 'react'
import { LAYOUT, GRID, GRID_OX, GRID_OZ } from './collision'

interface SlamMapProps {
  data?: number[][] // 0=空 1=障碍
}

// 把栅格障碍渲染成 3D 墙体，像真实场地俯视
export function SlamMap({ data }: SlamMapProps) {
  const grid = useMemo(() => data ?? LAYOUT, [data])
  const { cellSize, cols, rows } = GRID
  const ox = GRID_OX
  const oz = GRID_OZ

  const walls: JSX.Element[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== 1) continue
      const isPerimeter = x === 0 || y === 0 || x === cols - 1 || y === rows - 1
      const h = isPerimeter ? 0.7 : 0.35
      walls.push(
        <mesh
          key={`w-${x}-${y}`}
          position={[ox + x * cellSize + cellSize / 2, h / 2, oz + y * cellSize + cellSize / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[cellSize, h, cellSize]} />
          <meshStandardMaterial
            color={isPerimeter ? '#8a9ab5' : '#a8b8d0'}
            roughness={0.55}
            metalness={0.2}
            emissive={isPerimeter ? '#c8d4e8' : '#d8e2f0'}
            emissiveIntensity={0.15}
          />
        </mesh>,
      )
    }
  }

  return <group>{walls}</group>
}
