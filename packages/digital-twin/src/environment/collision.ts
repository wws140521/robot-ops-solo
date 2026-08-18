// 栅格地图配置（与 SlamMap 渲染一致，单一数据源）
export const GRID = {
  cols: 12,
  rows: 10,
  cellSize: 0.5,
} as const

export const GRID_OX = -(GRID.cols * GRID.cellSize) / 2 // -3
export const GRID_OZ = -(GRID.rows * GRID.cellSize) / 2 // -2.5

// 餐厅布局：0=空 1=障碍（外墙 + 隔墙 + 桌位）
export const LAYOUT: number[][] = (() => {
  const { cols: W, rows: H } = GRID
  const g: number[][] = Array.from({ length: H }, () => Array(W).fill(0))
  // 外墙
  for (let x = 0; x < W; x++) {
    g[0][x] = 1
    g[H - 1][x] = 1
  }
  for (let y = 0; y < H; y++) {
    g[y][0] = 1
    g[y][W - 1] = 1
  }
  // 内部隔墙（厨房 / 出餐口分区）
  for (let y = 1; y < 4; y++) g[y][4] = 1
  // 散落桌位
  ;[
    [2, 6],
    [3, 6],
    [2, 8],
    [3, 8],
    [6, 6],
    [6, 8],
    [9, 2],
    [9, 4],
  ].forEach(([x, y]) => {
    if (g[y]?.[x] !== undefined) g[y][x] = 1
  })
  return g
})()

export type CellType = 'wall' | 'table' | 'empty' | 'out'

// 世界坐标 → 栅格坐标
export function worldToGrid(worldX: number, worldZ: number): { gx: number; gy: number } {
  return {
    gx: Math.floor((worldX - GRID_OX) / GRID.cellSize),
    gy: Math.floor((worldZ - GRID_OZ) / GRID.cellSize),
  }
}

// 格子类型
export function getCellType(worldX: number, worldZ: number): CellType {
  const { gx, gy } = worldToGrid(worldX, worldZ)
  if (gx < 0 || gy < 0 || gx >= GRID.cols || gy >= GRID.rows) return 'out'
  if (LAYOUT[gy][gx] !== 1) return 'empty'
  const isPerimeter = gx === 0 || gy === 0 || gx === GRID.cols - 1 || gy === GRID.rows - 1
  return isPerimeter ? 'wall' : 'table'
}

// 是否在障碍格内（穿模检测）
export function isObstacle(worldX: number, worldZ: number): boolean {
  const t = getCellType(worldX, worldZ)
  return t === 'wall' || t === 'table'
}
