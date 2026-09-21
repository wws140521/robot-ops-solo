// PeanutBot.tsx
// 擎朗 Peanut 送餐机器人（peanut-001）
// 2026-09-08 URDF 化：加载 /models/peanut/robot.urdf
// 2026-09-09 STL mesh 版：URDF 改引 package://peanut_support/meshes/*.stl（6 件，
//   由 scripts/generate-peanut-stl.mjs 程序化生成），与工业臂同一套
//   three-urdf packageMap + convertToYUp 管线 + 模块级缓存策略，
//   防止组件重挂载导致 mesh 状态丢失（记忆约束：R3F <primitive> 卸载会破坏 URDF mesh）。
// URDF 缺失/损坏时降级到原程序化占位模型（PeanutBotFallback），页面永不空白。
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { parseURDF, loadRobot, type URDFRobot } from 'three-urdf'

interface PeanutBotProps {
  position: [number, number, number]
  rotation: [number, number, number]
}

// ── URDF 加载（模块级缓存，策略与 IndustrialRobotModel 一致）──────────────
const PEANUT_URDF_PATH = '/models/peanut/robot.urdf'

let cachedRobot: URDFRobot | null = null
let loadingPromise: Promise<URDFRobot> | null = null
let peanutAnchor: THREE.Group | null = null

function getAnchor(): THREE.Group {
  if (!peanutAnchor) {
    peanutAnchor = new THREE.Group()
    peanutAnchor.name = '__PEANUT_ANCHOR__'
  }
  return peanutAnchor
}

// URDF 材质只有基础色，金属度/粗糙度/自发光在这里补齐（对齐原占位模型观感）
function enhanceMaterials(robot: URDFRobot) {
  robot.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true

    const mat = mesh.material as THREE.MeshStandardMaterial | undefined
    if (!mat || Array.isArray(mat)) return
    const hex = mat.color.getHex()

    if (obj.parent?.name === 'link_head') {
      // 头部屏：深色底 + 蓝色自发光
      mat.metalness = 0.6
      mat.roughness = 0.3
      mat.emissive = new THREE.Color(0x1890ff)
      mat.emissiveIntensity = 0.55
    } else if (obj.parent?.name === 'link_nav_light') {
      // 导航灯：暖黄高亮
      mat.emissive = new THREE.Color(0xffd54f)
      mat.emissiveIntensity = 1.4
    } else if (hex === 0xff7a18) {
      // 橙色主体（底盘/立柱）
      mat.metalness = 0.45
      mat.roughness = 0.32
    } else if (hex === 0xfff3e0) {
      // 奶油色托盘
      mat.metalness = 0.1
      mat.roughness = 0.5
    }
    mat.needsUpdate = true
  })
}

// three-urdf 0.1.1 的 buildRobot 只渲染 mesh 型 visual（源码 `if (type !== 'mesh') continue`）。
// 2026-09-09 起 URDF 全部用 STL mesh，此函数降级为安全网：
// 万一 URDF 里混回内联 box/sphere/cylinder（如手改调试），还能补齐渲染不至于空壳。
// （与记忆中 STL 静默跳过是同类陷阱：不数 mesh 就以为加载成功了）
function attachPrimitiveVisuals(parsed: ReturnType<typeof parseURDF>, robot: URDFRobot) {
  for (const [linkName, link] of parsed.links) {
    const linkGroup = robot.links.get(linkName)
    if (!linkGroup) continue
    for (const visual of link.visuals) {
      const g = visual.geometry
      let geo: THREE.BufferGeometry | null = null
      if (g.type === 'box') {
        geo = new THREE.BoxGeometry(g.size.x, g.size.y, g.size.z)
      } else if (g.type === 'sphere') {
        geo = new THREE.SphereGeometry(g.radius, 24, 16)
      } else if (g.type === 'cylinder') {
        geo = new THREE.CylinderGeometry(g.radius, g.radius, g.length, 24)
      } else {
        continue // mesh 型 loadRobot 已处理
      }

      // 材质：visual.material 是材质名字符串时查全局材质表，查不到给中性灰
      // 注意 URDF rgba 是 sRGB 值，必须 setRGB(..., SRGBColorSpace) 声明色彩空间；
      // 直接 new Color(r,g,b) 会按 linear 存，渲染出来发白（#ff7a18 → #ffb856）
      let color = 0x888888
      const urdfColor =
        typeof visual.material === 'string'
          ? parsed.materials.get(visual.material)?.color
          : visual.material?.color
      if (urdfColor) {
        color = new THREE.Color().setRGB(urdfColor.r, urdfColor.g, urdfColor.b, THREE.SRGBColorSpace).getHex()
      }
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6 })

      const mesh = new THREE.Mesh(geo, mat)
      mesh.name = `visual_${linkName}_${visual.name || 'primitive'}`
      mesh.position.copy(visual.origin.xyz)
      // URDF rpy → three Euler（ZYX 顺序，与 three-urdf 内部 rpyToEuler 一致）
      mesh.rotation.set(visual.origin.rpy.r, visual.origin.rpy.p, visual.origin.rpy.y)
      mesh.rotation.order = 'ZYX'
      mesh.castShadow = true
      linkGroup.add(mesh)
    }
  }
}

async function loadPeanutRobot(): Promise<URDFRobot> {
  if (cachedRobot) return cachedRobot
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      const res = await fetch(PEANUT_URDF_PATH)
      if (!res.ok) throw new Error(`URDF 不存在: ${PEANUT_URDF_PATH} (status ${res.status})`)
      const urdfText = await res.text()
      // 2026-09-09 packageMap 必须给：URDF 现在引用 package://peanut_support/meshes/*.stl，
      // 不给映射 three-urdf 找不到文件会静默跳过（记忆约束：mesh 型加载失败只有 console.warn）
      const parsed = parseURDF(urdfText, { packageMap: { peanut_support: '/models/peanut' } })
      // URDF 是 z-up（ROS 约定，STL 同），转 three.js y-up（不转会躺平 90°）
      const robot = await loadRobot(parsed, { convertToYUp: true, showDebug: false })
      // 补内联几何 + 材质增强（金属度/粗糙度/自发光）
      attachPrimitiveVisuals(parsed, robot)
      enhanceMaterials(robot)

      let meshCount = 0
      robot.traverse((obj) => { if ((obj as THREE.Mesh).isMesh) meshCount++ })
      if (meshCount === 0) throw new Error('URDF 加载后 mesh 数为 0（STL 未加载？检查 packageMap 与 meshes/ 目录）')
      console.log(`[PeanutBot] URDF loaded, mesh count=${meshCount}`)
      // dev 调试句柄（与 G1/Industrial 一致）
      if ((import.meta as any).env?.DEV) {
        ;(window as any).__peanutRobot = robot
      }

      cachedRobot = robot
      return robot
    } finally {
      loadingPromise = null
    }
  })()
  return loadingPromise
}

// ── 主组件：URDF 优先，失败降级占位模型 ──────────────────────────────
export function PeanutBot({ position, rotation }: PeanutBotProps) {
  const { scene } = useThree()
  const anchor = getAnchor()
  const [failed, setFailed] = useState(false)
  // useFrame 闭包读最新 props（与 IndustrialRobotModel 同法）
  const posRef = useRef(position)
  const rotRef = useRef(rotation)
  posRef.current = position
  rotRef.current = rotation

  // 加载 URDF 并挂到 anchor
  useEffect(() => {
    if (cachedRobot) {
      if (!cachedRobot.parent) anchor.add(cachedRobot)
      return
    }
    loadPeanutRobot()
      .then((robot) => {
        if (!robot.parent) anchor.add(robot)
      })
      .catch((err) => {
        console.warn('[PeanutBot] URDF 加载失败，降级到占位模型:', err)
        setFailed(true)
      })
  }, [anchor])

  // anchor 进场景（Object3D.add 会自动从旧场景摘除，路由切换安全）
  useEffect(() => {
    scene.add(anchor)
    return () => { anchor.visible = false }
  }, [anchor, scene])

  // 每帧同步位置/旋转：anchor 直挂 scene，外层 R3F group 变换管不到它
  useFrame(() => {
    anchor.visible = !failed
    anchor.position.set(posRef.current[0], posRef.current[1], posRef.current[2])
    anchor.rotation.set(rotRef.current[0], rotRef.current[1], rotRef.current[2])
  })

  if (failed) return <PeanutBotFallback position={position} rotation={rotation} />
  return null
}

// ── 降级占位模型（原 PeanutBot 实现，URDF 失败时兜底）──────────────────
export function PeanutBotFallback({ position, rotation }: PeanutBotProps) {
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
