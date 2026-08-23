import { useMemo } from 'react'
import { LAYOUT, GRID, GRID_OX, GRID_OZ } from './collision'

interface SlamMapProps {
  data?: number[][] // 0=空 1=障碍
  wallPerimColor?: string
  wallInnerColor?: string
  wallPerimEmissive?: string
  wallInnerEmissive?: string
}

/**
 * 把栅格障碍渲染成 3D 墙体（俯视场地）。
 * 颜色完全走 CSS 变量派生 → 深浅主题 / 贴牌换肤自动同步。
 */
export function SlamMap({
  data,
  wallPerimColor = '#2a3e34',
  wallInnerColor = '#22342c',
  wallPerimEmissive = '#183a28',
  wallInnerEmissive = '#193545',
}: SlamMapProps = {}) {
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
            color={isPerimeter ? wallPerimColor : wallInnerColor}
            roughness={0.55}
            metalness={0.2}
            emissive={isPerimeter ? wallPerimEmissive : wallInnerEmissive}
            emissiveIntensity={0.15}
          />
        </mesh>,
      )
    }
  }

  return <group>{walls}</group>
}
