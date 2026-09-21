// generate-peanut-stl.mjs
// 程序化生成 Keenon Peanut 送餐机器人的 STL 部件（peanut-001）
//
// 背景：原 URDF 用内联 box/sphere（方块几何，观感生硬），2026-09-09 起换成
// 与工业臂同一套 three-urdf STL mesh 管线（package://peanut_support/meshes/…）。
// Keenon 官方没有公开 URDF/STL 仓库（不像宇树 unitree_ros），因此按真机造型
// 程序化生成：圆角回转体底盘 + 防撞圈 + 圆盘托盘（带沿口）+ 锥形立柱 + 胶囊头。
//
// 坐标约定：输出 ROS z-up STL（与工业臂 STL 一致，three-urdf convertToYUp 负责转回）。
// 尺寸与原内联 box 版逐件一致（URDF origin xyz 全部不动），落地间隙 0.07m 保持不变。
//
// 运行：node packages/digital-twin/scripts/generate-peanut-stl.mjs
import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../../../apps/web-console/public/models/peanut/meshes')

// three 几何默认 Y-up；rotateX(+90°) 把 +Y 映到 +Z，输出即 z-up STL
const Z_UP = Math.PI / 2

// 回转体：profile 是 [半径, 高度] 数组（沿 Y 轴旋转后再转 z-up），segments 控制圆滑度
function lathe(points, segments = 48) {
  const profile = points.map(([r, z]) => new THREE.Vector2(r, z))
  const geo = new THREE.LatheGeometry(profile, segments)
  geo.rotateX(Z_UP)
  return geo
}

const parts = {}

// 1. 底盘：橙色圆角回转体，r=0.30，高 ±0.15，顶部收口给立柱留台
//    （对应原 box 0.6×0.5×0.3 @z=0.22，底部离地 0.07m 不变）
parts.base = lathe([
  [0.0, -0.15],
  [0.22, -0.15],
  [0.295, -0.125],
  [0.3, -0.1],
  [0.3, 0.1],
  [0.295, 0.125],
  [0.22, 0.15],
  [0.14, 0.15],
  [0.0, 0.15],
])

// 2. 防撞圈：底盘底部深色橡胶环（真机特征件），环半径 0.30、管径 0.022
//    TorusGeometry 建在 XY 平面，rotateX(90°) 后平躺且正好是 z-up
parts.bumper = (() => {
  const geo = new THREE.TorusGeometry(0.3, 0.022, 12, 48)
  geo.rotateX(Z_UP)
  return geo
})()

// 3. 托盘：奶油色圆盘带沿口（上下层共用同一 STL），r=0.33、厚 ±0.03
//    （对应原 box 0.68×0.58×0.06；直径 0.66 ≈ 原宽 0.68）
parts.tray = lathe([
  [0.0, -0.03],
  [0.28, -0.03],
  [0.325, -0.012],
  [0.33, 0.005],
  [0.315, 0.03],
  [0.28, 0.032],
  [0.0, 0.02],
])

// 4. 立柱：橙色锥形柱，r 0.065→0.055，高 ±0.25
//    （对应原 box 0.14×0.14×0.5 @z=0.7）
parts.column = lathe([
  [0.0, -0.25],
  [0.065, -0.25],
  [0.065, -0.05],
  [0.055, 0.25],
  [0.0, 0.25],
])

// 5. 头部：深色圆润舱（加载后 PeanutBot.tsx 叠 emissive 蓝屏光），r=0.13、高 ±0.12
//    （对应原 box 0.28×0.13×0.24 @z=1.24）
parts.head = lathe([
  [0.0, -0.12],
  [0.05, -0.117],
  [0.095, -0.09],
  [0.13, -0.035],
  [0.13, 0.035],
  [0.095, 0.09],
  [0.05, 0.117],
  [0.0, 0.12],
])

// 6. 导航灯：暖黄小球 r=0.04（球对称，无需转轴）
//    （对应原 sphere r=0.04 @（0,-0.3,0.4)，加载后叠 emissive）
parts.nav_light = new THREE.SphereGeometry(0.04, 24, 16)

// ── 导出二进制 STL ──────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
const exporter = new STLExporter()

let total = 0
for (const [name, geo] of Object.entries(parts)) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
  mesh.updateMatrixWorld(true)
  const view = exporter.parse(mesh, { binary: true }) // DataView
  const buf = Buffer.from(view.buffer, view.byteOffset, view.byteLength)
  const file = join(OUT_DIR, `${name}.stl`)
  writeFileSync(file, buf)
  const tris = Math.round(buf.byteLength / 50) // 二进制 STL 每三角面 50B
  total += tris
  console.log(`[peanut-stl] ${name}.stl  ${(buf.byteLength / 1024).toFixed(1)} KB  ~${tris} tris`)
}
console.log(`[peanut-stl] done → ${OUT_DIR} （合计 ~${total} tris）`)
