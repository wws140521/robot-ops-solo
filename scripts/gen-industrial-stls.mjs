// 生成 4 个工业品牌的最小可用 STL mesh
// 因为拿不到官方 CAD，就按 FanucArm/KukaArm 里的大概比例用圆柱体+球体组合，
// 然后写成二进制 STL。效果肯定不如真模型，但能直接用 URDF 渲染不降级，
// 后续有了官方 STL 直接覆盖同名文件就行
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_ROOT = path.resolve(__dirname, '../apps/web-console/public/models')

// three 没装在根 workspace，用 createRequire 从 digital-twin 那儿加载
const req = createRequire(path.resolve(__dirname, '../packages/digital-twin/package.json'))
const THREE = req('three')

// 每个品牌的尺寸（大概比例，后续可以按真实模型改）
const BRAND_CONFIGS = {
  fanuc: {
    linkParams: {
      baseH: 0.25, baseR: 0.16,
      j1H: 0.15, j1R: 0.08,
      j2Len: 0.35, j2R: 0.055,
      j3Len: 0.25, j3R: 0.048,
      j4Len: 0.12, j4R: 0.04,
      j5Len: 0.10, j5R: 0.035,
      j6Len: 0.08, j6R: 0.03,
    },
    style: { j1Box: false, j2Box: false, j3Box: false },
  },
  kuka: {
    linkParams: {
      baseH: 0.25, baseR: 0.16,
      j1H: 0.15, j1R: 0.08,
      j2Len: 0.30, j2R: 0.052,
      j3Len: 0.22, j3R: 0.045,
      j4Len: 0.10, j4R: 0.038,
      j5Len: 0.08, j5R: 0.033,
      j6Len: 0.06, j6R: 0.028,
    },
    style: { j1Box: true, j2Box: true, j3Box: true }, // KUKA 经典方盒子
  },
  estun: {
    linkParams: {
      baseH: 0.22, baseR: 0.14,
      j1H: 0.14, j1R: 0.075,
      j2Len: 0.28, j2R: 0.05,
      j3Len: 0.20, j3R: 0.042,
      j4Len: 0.09, j4R: 0.036,
      j5Len: 0.08, j5R: 0.03,
      j6Len: 0.06, j6R: 0.026,
    },
    style: { j1Box: false, j2Box: false, j3Box: false },
  },
  yaskawa: {
    linkParams: {
      baseH: 0.23, baseR: 0.15,
      j1H: 0.15, j1R: 0.078,
      j2Len: 0.32, j2R: 0.054,
      j3Len: 0.24, j3R: 0.046,
      j4Len: 0.11, j4R: 0.038,
      j5Len: 0.09, j5R: 0.032,
      j6Len: 0.07, j6R: 0.027,
    },
    style: { j1Box: false, j2Box: true, j3Box: false },
  },
}

const LINK_NAMES = ['base', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6']

// 把一个 geometry 拆成三角形数组（每三角形 12 float = normal(3) + 3 vertices(3)）
function geomToTriBuffers(geom) {
  geom.computeVertexNormals()
  const g = geom.index ? geom.toNonIndexed() : geom
  const pos = g.attributes.position
  const norm = g.attributes.normal
  const out = []
  for (let i = 0; i < pos.count; i += 3) {
    const buf = new Float32Array(12)
    buf[0] = norm.getX(i); buf[1] = norm.getY(i); buf[2] = norm.getZ(i)
    for (let k = 0; k < 3; k++) {
      const idx = i + k
      buf[3 + k * 3] = pos.getX(idx)
      buf[4 + k * 3] = pos.getY(idx)
      buf[5 + k * 3] = pos.getZ(idx)
    }
    out.push(buf)
  }
  return out
}

// 底座：圆盘 + 安装法兰
function buildBase(p) {
  const parts = []
  // 主圆盘
  const body = new THREE.CylinderGeometry(p.baseR, p.baseR * 1.1, p.baseH, 32)
  body.translate(0, p.baseH / 2, 0)
  parts.push(body)
  // 底部法兰（薄一点）
  const flange = new THREE.CylinderGeometry(p.baseR * 1.28, p.baseR * 1.28, 0.02, 32)
  flange.translate(0, 0.01, 0)
  parts.push(flange)
  // 顶部加个小凸台（上面装 j1）
  const top = new THREE.CylinderGeometry(p.baseR * 0.65, p.baseR * 0.8, 0.025, 24)
  top.translate(0, p.baseH + 0.012, 0)
  parts.push(top)

  let all = []
  for (const g of parts) {
    all = all.concat(geomToTriBuffers(g))
    g.dispose()
  }
  return all
}

// 机械臂节：圆柱+两端球。默认连杆向下延伸，顶部在原点（刚好挂在上一级关节上）
function buildLinkSegment(radius, length, { box = false, flange = false } = {}) {
  const parts = []
  if (box) {
    const w = radius * 2.3
    const h = radius * 1.9
    const boxGeom = new THREE.BoxGeometry(w, length * 0.95, h)
    boxGeom.translate(0, -length / 2, 0)
    parts.push(boxGeom)
  } else {
    const cyl = new THREE.CylinderGeometry(radius * 0.92, radius, length, 22)
    cyl.translate(0, -length / 2, 0)
    parts.push(cyl)
  }
  // 顶部关节球
  const top = new THREE.SphereGeometry(radius * 1.2, 18, 14)
  parts.push(top)
  // 底部法兰盘（可选）
  if (flange) {
    const f = new THREE.CylinderGeometry(radius * 1.05, radius * 0.85, 0.025, 20)
    f.translate(0, -length, 0)
    parts.push(f)
  }
  let all = []
  for (const g of parts) {
    all = all.concat(geomToTriBuffers(g))
    g.dispose()
  }
  return all
}

// 构建某个品牌某个连杆的三角面片
function buildLinkTriangles(brand, linkName, cfg) {
  const p = cfg.linkParams
  const s = cfg.style
  switch (linkName) {
    case 'base':
      return buildBase(p)
    case 'j1':
      return buildLinkSegment(p.j1R, p.j1H, { box: s.j1Box })
    case 'j2':
      return buildLinkSegment(p.j2R, p.j2Len, { box: s.j2Box })
    case 'j3':
      return buildLinkSegment(p.j3R, p.j3Len, { box: s.j3Box })
    case 'j4':
      return buildLinkSegment(p.j4R, p.j4Len)
    case 'j5':
      return buildLinkSegment(p.j5R, p.j5Len)
    case 'j6':
      return buildLinkSegment(p.j6R, p.j6Len, { flange: true })
    default:
      throw new Error(`unknown link: ${linkName}`)
  }
}

// 写二进制 STL
// 80 字节 header + 4 字节 triangle 数 + 每三角形 50 字节
function writeStl(filePath, triangleBuffers) {
  const header = Buffer.alloc(80)
  header.write('robot-ops-solo::gen-industrial-stls', 0, 'utf8')
  const count = triangleBuffers.length
  const data = Buffer.alloc(84 + count * 50)
  header.copy(data, 0)
  data.writeUInt32LE(count, 80)
  for (let i = 0; i < count; i++) {
    const buf = triangleBuffers[i]
    const off = 84 + i * 50
    for (let j = 0; j < 12; j++) {
      data.writeFloatLE(buf[j], off + j * 4)
    }
    // attribute byte count 写 0
    data.writeUInt16LE(0, off + 48)
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, data)
}

// main
let total = 0
for (const [brand, cfg] of Object.entries(BRAND_CONFIGS)) {
  console.log(`\n[${brand}]`)
  for (const linkName of LINK_NAMES) {
    const tris = buildLinkTriangles(brand, linkName, cfg)
    const outPath = path.join(PUBLIC_ROOT, brand, 'meshes', `${linkName}_link.STL`)
    writeStl(outPath, tris)
    total++
    const kb = Math.round(fs.statSync(outPath).size / 1024)
    console.log(`  - meshes/${linkName}_link.STL  (${tris.length} tris, ${kb} KB)`)
  }
}
console.log(`\n全部生成完毕，共 ${total} 个 STL 文件 → ${path.relative(process.cwd(), PUBLIC_ROOT)}`)
