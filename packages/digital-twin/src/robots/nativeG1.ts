/**
 * nativeG1.ts
 * 原生 Three.js（非 R3F）加载 Unitree G1 人形机器人
 *
 * 用于 AMap GLCustomLayer 等非 R3F 场景，直接往 THREE.Scene 里加 URDFRobot。
 * 自动处理脚底对齐地面 + 材质优化。
 *
 * 用法：
 *   import { loadG1ForScene } from 'digital-twin'
 *   const anchor = await loadG1ForScene(threeScene)
 *   anchor.position.set(x, y, z)
 *   anchor.rotation.y = heading
 */
import * as THREE from 'three'
import { parseURDF, loadRobot, type URDFRobot } from 'three-urdf'

const URDF_PATH = '/models/g1/g1_29dof.urdf'
const PACKAGE_MAP: Record<string, string> = { g1_description: '/models/g1' }

// 模块级缓存 — 全局只加载一次
let cachedRobot: URDFRobot | null = null
let cachedAnchor: THREE.Group | null = null

export interface G1LoadResult {
  /** 外部控制用的 anchor group，移动/旋转它即可 */
  anchor: THREE.Group
  /** URDFRobot 实例（驱动关节用 robot.setJointValues()） */
  robot: URDFRobot
  /** 身高（米） */
  height: number
}

/**
 * 加载 G1 URDF + STL mesh 并添加到原生 Three.js scene。
 * 可重复调用（返回同一 anchor），不会重复加载或重复 add。
 */
export async function loadG1ForScene(scene: THREE.Scene): Promise<G1LoadResult> {
  // 命中缓存 → 直接返回
  if (cachedRobot && cachedAnchor) {
    if (!scene.children.includes(cachedAnchor)) {
      scene.add(cachedAnchor)
    }
    return { anchor: cachedAnchor, robot: cachedRobot, height: 1.30 }
  }

  // 1. 拿 URDF
  const res = await fetch(URDF_PATH)
  if (!res.ok) throw new Error(`[nativeG1] URDF fetch failed: HTTP ${res.status}`)
  const urdfText = await res.text()

  // 2. 解析 + 加载 STL
  const model = parseURDF(urdfText, { packageMap: PACKAGE_MAP })
  const robot = await loadRobot(model, { convertToYUp: true, showDebug: false })

  // 3. 材质优化（PBR 金属质感）
  robot.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh) {
      const mat = mesh.material as THREE.MeshStandardMaterial
      if (mat) {
        mat.metalness = Math.max(mat.metalness ?? 0.5, 0.6)
        mat.roughness = Math.min(mat.roughness ?? 0.4, 0.35)
      }
    }
  })

  // 4. 脚底对齐地面（自动测量 bounding box）
  const box = new THREE.Box3().setFromObject(robot)
  const footY = box.min.y
  const height = box.max.y - box.min.y
  if (footY < 0) {
    robot.position.y = -footY
    robot.updateMatrixWorld(true)
  }

  // 5. 挂到 anchor，加入 scene
  cachedAnchor = new THREE.Group()
  cachedAnchor.name = 'g1-anchor'
  cachedAnchor.add(robot)
  scene.add(cachedAnchor)

  cachedRobot = robot
  return { anchor: cachedAnchor, robot, height }
}
