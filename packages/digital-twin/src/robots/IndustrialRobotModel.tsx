// 通用工业机器人 URDF 加载器
// 和 G1Humanoid 思路一致：three-urdf 加载 URDF + STL，模块级缓存防止重挂载丢状态
// 当模型文件缺失或损坏时，通过 onLoadError 通知上层降级到程序化机械臂
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { parseURDF, loadRobot, type URDFRobot } from 'three-urdf'
import type { JointTelemetry } from 'robot-adapter-kit'
import {
  INDUSTRIAL_MODELS,
  telemetryToUrdfJoints,
  type IndustrialBrand,
} from '../config/industrial-models'

interface Props {
  brand: IndustrialBrand
  position: [number, number, number]
  rotation: [number, number, number]
  scale?: number
  joints: JointTelemetry[]
  visible?: boolean
  // 单机模式默认 true：隐藏其他品牌 anchor，防止切换设备时旧模型残影
  // 舰队全景同屏渲染多品牌时要传 false，不然后挂载的会把先挂载的全藏掉
  isolate?: boolean
  // 告警→3D 联动：故障关节号（1-based，J1~J6），该关节臂段红色脉冲闪烁定位故障
  faultJoint?: number | null
  // 加载失败时通知上层降级
  onLoadError?: (err: Error) => void
}

// 每个品牌一个缓存实例，key 为 brand
const robotCache: Record<string, URDFRobot | null> = {}
const anchorCache: Record<string, THREE.Group> = {}
const loadingPromise: Record<string, Promise<URDFRobot> | null> = {}
const loadError: Record<string, Error | null> = {}

function getAnchor(brand: string): THREE.Group {
  if (!anchorCache[brand]) {
    const anchor = new THREE.Group()
    anchor.name = `__INDUSTRIAL_ANCHOR_${brand}__`
    anchorCache[brand] = anchor
  }
  return anchorCache[brand]
}

async function loadIndustrialRobot(brand: IndustrialBrand): Promise<URDFRobot> {
  if (robotCache[brand]) return robotCache[brand]!
  if (loadingPromise[brand]) return loadingPromise[brand]!

  const cfg = INDUSTRIAL_MODELS[brand]
  const promise = (async () => {
    try {
      const res = await fetch(cfg.urdfPath)
      if (!res.ok) {
        throw new Error(`URDF 不存在: ${cfg.urdfPath} (status ${res.status})`)
      }
      const urdfText = await res.text()
      const parsed = parseURDF(urdfText, { packageMap: cfg.packageMap })
      // 官方 ROS-Industrial URDF 是 Z-up 的，让 three-urdf 转成 three.js 的 Y-up
      // 不转的话模型会躺平 90 度
      const robot = await loadRobot(parsed, { convertToYUp: true, showDebug: false })

      // 调试：打印 mesh 数量和材质颜色，看看 URDF material 有没有生效
      let debugMeshCount = 0
      robot.traverse((obj: any) => {
        if (obj.isMesh) {
          debugMeshCount++
          let mat = obj.material
          if (mat && mat.color) {
            console.log(`[IndustrialRobotModel] ${brand} mesh ${obj.name}: color=#${mat.color.getHexString()}`)
          }
          // 材质克隆成独立实例：URDF 材质常被多个 link 共享（FANUC 整臂一个橙），
          // 不隔离的话给单关节上负载色会把整条手臂染红
          if (mat && !Array.isArray(mat)) {
            mat = mat.clone()
            obj.material = mat
            // 缓存原始颜色/自发光，负载恢复正常档时还原成品牌原色
            mat.userData.__origColor = mat.color.getHex()
            mat.userData.__origEmissive = mat.emissive ? mat.emissive.getHex() : 0
            mat.userData.__origEmissiveIntensity = mat.emissiveIntensity ?? 1
          }
          // STL 法线可能反了，强制重算法线 + 双面渲染，不然会一片黑
          if (obj.geometry) {
            obj.geometry.computeVertexNormals()
          }
          if (mat) {
            mat.side = THREE.DoubleSide
            mat.needsUpdate = true
          }
        }
      })
      console.log(`[IndustrialRobotModel] ${brand} loaded, mesh count=${debugMeshCount}`)
      // dev 调试句柄：浏览器里检查关节层级/材质颜色用（仅开发环境）
      if ((import.meta as any).env?.DEV) {
        ;(window as any).__industrialRobots = (window as any).__industrialRobots || {}
        ;(window as any).__industrialRobots[brand] = robot
      }

      robotCache[brand] = robot
      loadError[brand] = null
      return robot
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      loadError[brand] = error
      throw error
    } finally {
      loadingPromise[brand] = null
    }
  })()

  loadingPromise[brand] = promise
  return promise
}

// ─── 关节负载颜色映射（工业交付可视化）─────────────────────────
// >100% 红色（超载）/ >80% 黄色（预警）/ 正常恢复品牌原色
// 上色对象是关节的 child link（URDF 层级：link → joint → child link，
// child link 的 mesh 正好是该段臂身），自发光叠加让告警色在深浅主题都醒目
const LOAD_RED = 0xff3d71
const LOAD_YELLOW = 0xffcc00

function applyJointLoadColors(
  robot: URDFRobot,
  joints: JointTelemetry[],
  cfg: { jointMap: Record<number, string> }
) {
  joints.forEach((jt) => {
    const jointName = cfg.jointMap[jt.j]
    if (!jointName) return
    const joint = robot.joints.get(jointName)
    // joint 的子节点就是它驱动的下一段臂身（link_<name> 命名）
    const childLink = joint?.children.find((c) => c.name?.startsWith('link_'))
    if (!childLink) return
    const load = jt.load_pct ?? 0

    childLink.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined
      if (!mat || Array.isArray(mat) || mat.userData.__origColor === undefined) return
      if (load > 100) {
        mat.color.setHex(LOAD_RED)
        mat.emissive?.setHex(LOAD_RED)
        mat.emissiveIntensity = 0.45
      } else if (load > 80) {
        mat.color.setHex(LOAD_YELLOW)
        mat.emissive?.setHex(LOAD_YELLOW)
        mat.emissiveIntensity = 0.35
      } else {
        mat.color.setHex(mat.userData.__origColor)
        mat.emissive?.setHex(mat.userData.__origEmissive ?? 0)
        mat.emissiveIntensity = mat.userData.__origEmissiveIntensity ?? 1
      }
    })
  })
}

// 还原指定关节臂段的材质到品牌原色（故障闪烁解除时用）
// 闪烁是每帧压着负载色刷的，解除后要手动刷回原色，负载色逻辑下一帧遥测自然接管
// 只处理 link 的直接 mesh 子节点——闪烁本来就只染故障关节那一段臂身
function restoreJointColor(robot: URDFRobot, jointName: string | undefined) {
  if (!jointName) return
  const joint = robot.joints.get(jointName)
  const childLink = joint?.children.find((c) => c.name?.startsWith('link_'))
  if (!childLink) return
  childLink.children.forEach((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined
    if (!mat || Array.isArray(mat) || mat.userData.__origColor === undefined) return
    mat.color.setHex(mat.userData.__origColor)
    mat.emissive?.setHex(mat.userData.__origEmissive ?? 0)
    mat.emissiveIntensity = mat.userData.__origEmissiveIntensity ?? 1
  })
}

export function IndustrialRobotModel({
  brand,
  position,
  rotation,
  scale = 1,
  joints,
  visible = true,
  isolate = true,
  faultJoint = null,
  onLoadError,
}: Props) {
  const { scene } = useThree()
  const anchor = getAnchor(brand)
  const [ready, setReady] = useState(robotCache[brand] !== null && robotCache[brand] !== undefined)
  const reportedErrorRef = useRef(false)

  // 加载 URDF 并加入 anchor
  useEffect(() => {
    if (robotCache[brand]) {
      if (anchor.children.length === 0 && robotCache[brand]) {
        anchor.add(robotCache[brand])
      }
      setReady(true)
      return
    }

    loadIndustrialRobot(brand)
      .then((robot) => {
        if (anchor.children.length === 0) {
          anchor.add(robot)
        }
        setReady(true)
      })
      .catch((err) => {
        if (!reportedErrorRef.current) {
          reportedErrorRef.current = true
          onLoadError?.(err)
        }
      })
  }, [brand, anchor, onLoadError])

  // 把 anchor 加入场景，只加一次
  // 单机模式下同时隐藏其他品牌的 anchor（isolate=true），避免切换设备时多个模型叠在一起
  // 舰队全景 isolate=false：4 品牌本来就要同屏，谁也不许藏谁
  useEffect(() => {
    // 2026-09-09 修复跨视图导航后工业臂永久消失：原 !anchor.parent 在舰队↔单机
    // 切换时仍指向已销毁的旧 scene（truthy），跳过 add。改为与当前 scene 实际比对。
    if (anchor.parent !== scene) {
      scene.add(anchor)
    }
    if (isolate) {
      // 把同类型其他品牌的 anchor 都藏起来，只留当前这个
      Object.keys(anchorCache).forEach((b) => {
        if (b !== brand) anchorCache[b].visible = false
      })
    }
    // 组件卸载时把自己的 anchor 也藏掉，不然切到非工业设备时它还亮着
    return () => {
      anchor.visible = false
    }
  }, [anchor, scene, brand, isolate])

  // 每帧同步位置/旋转/缩放，visible 也在这里控制
  // 因为 anchor 是直接挂在 scene 上的，外层 R3F group 的 visible 管不到它
  useFrame(() => {
    const cfg = INDUSTRIAL_MODELS[brand]
    anchor.visible = visible
    anchor.position.set(position[0], position[1] + cfg.liftY, position[2])
    anchor.rotation.set(rotation[0], rotation[1], rotation[2])
    anchor.scale.setScalar(scale * cfg.scale)
  })

  // 关节目标角：遥测 2Hz 更新一次，真正的角度设置在 useFrame 里平滑做
  // 直接 setJointValues 会一跳一跳的，看不出梯形速度曲线
  const jointTargetsRef = useRef<Record<string, number>>({})
  const jointCurrentRef = useRef<Record<string, number>>({})
  const snappedBrandRef = useRef<string | null>(null)

  useEffect(() => {
    const cfg = INDUSTRIAL_MODELS[brand]
    jointTargetsRef.current = telemetryToUrdfJoints(joints, cfg)
    // 负载颜色跟遥测同频刷新（2Hz），负载回落后下一帧就恢复品牌原色
    const robot = robotCache[brand]
    if (robot) {
      applyJointLoadColors(robot, joints, cfg)
    }
  }, [brand, joints])

  // 故障关节跟踪：faultJoint 清空/切换时还原上一个闪烁关节的品牌原色
  // （闪烁是 useFrame 里逐帧刷的，不清掉会一直红着）
  const prevFaultRef = useRef<{ brand: string; joint: number } | null>(null)
  useEffect(() => {
    const prev = prevFaultRef.current
    const cur = faultJoint != null ? { brand, joint: faultJoint } : null
    prevFaultRef.current = cur
    if (prev && (prev.brand !== cur?.brand || prev.joint !== cur?.joint)) {
      const robot = robotCache[prev.brand]
      if (robot) {
        restoreJointColor(robot, INDUSTRIAL_MODELS[prev.brand as IndustrialBrand].jointMap[prev.joint])
      }
    }
  }, [faultJoint, brand])

  // 关节角平滑：每帧朝目标插值（时间常数 0.25s，跟遥测间隔匹配）
  // 机器人刚就绪或切品牌时直接吸附到目标，别从零位慢慢摆过去
  useFrame(({ clock }, delta) => {
    const robot = robotCache[brand]
    if (!robot) return
    const targets = jointTargetsRef.current
    const cur = jointCurrentRef.current

    // ── 故障关节红色脉冲闪烁（告警→3D 联动）──
    // 60Hz 逐帧刷，压过 2Hz 的负载色刷新；sin 脉冲让故障位置一眼锁定
    // 只染 link 的直接 mesh 子节点（= 该关节驱动的那段臂身），下游臂段不跟着闪
    if (faultJoint != null) {
      const jointName = INDUSTRIAL_MODELS[brand].jointMap[faultJoint]
      const joint = robot.joints.get(jointName)
      const childLink = joint?.children.find((c) => c.name?.startsWith('link_'))
      if (childLink) {
        const pulse = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 7))
        childLink.children.forEach((obj) => {
          const mesh = obj as THREE.Mesh
          if (!mesh.isMesh) return
          const mat = mesh.material as THREE.MeshStandardMaterial | undefined
          if (!mat || Array.isArray(mat) || mat.userData.__origColor === undefined) return
          mat.color.setHex(LOAD_RED)
          mat.emissive?.setHex(LOAD_RED)
          mat.emissiveIntensity = pulse
        })
      }
    }

    if (snappedBrandRef.current !== brand) {
      // 初次加载/切品牌：一次到位
      snappedBrandRef.current = brand
      for (const name of Object.keys(targets)) {
        cur[name] = targets[name]
      }
      try {
        robot.setJointValues({ ...targets })
      } catch {
        // 关节名不匹配，忽略
      }
      return
    }

    const k = 1 - Math.exp(-delta / 0.25)
    let moving = false
    const next: Record<string, number> = {}
    for (const name of Object.keys(targets)) {
      const diff = targets[name] - (cur[name] ?? targets[name])
      if (Math.abs(diff) > 0.0003) {
        cur[name] = (cur[name] ?? targets[name]) + diff * k
        moving = true
      } else {
        cur[name] = targets[name]
      }
      next[name] = cur[name]
    }
    if (moving) {
      try {
        robot.setJointValues(next)
      } catch {
        // setJointValues 可能因关节名不匹配报错，静默跳过
      }
    }
  })

  if (!ready) {
    return null
  }

  return null
}
