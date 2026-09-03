// nativeG1.ts
// 原生 Three.js（非 R3F）加载 Unitree G1 人形机器人
// 给 AMap GLCustomLayer 这种非 R3F 场景用，直接往 THREE.Scene 里挂 URDFRobot
// 会自动把脚底对齐地面，材质也顺手调一下
import * as THREE from 'three'
import { parseURDF, loadRobot, type URDFRobot } from 'three-urdf'

const URDF_PATH = '/models/g1/g1_29dof.urdf'
const PACKAGE_MAP: Record<string, string> = { g1_description: '/models/g1' }

// 模块级缓存 — 全局只加载一次
let cachedRobot: URDFRobot | null = null
let cachedAnchor: THREE.Group | null = null

export interface G1LoadResult {
  // 外部操控用这个 group，移动/旋转它就行
  anchor: THREE.Group
  // URDFRobot 实例，关节动画用 robot.setJointValues()
  robot: URDFRobot
  // 身高，单位米
  height: number
}

// 加载 G1 的 URDF + STL mesh，加到原生 Three.js scene
// 可以重复调用，返回同一个 anchor，不会重复加载也不会重复 add
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
