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
  // 加载失败时通知 RobotViewer 降级
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
      const parsed = parseURDF(urdfText, cfg.packageMap)
      const robot = await loadRobot(parsed)
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

export function IndustrialRobotModel({
  brand,
  position,
  rotation,
  scale = 1,
  joints,
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
  useEffect(() => {
    if (!anchor.parent) {
      scene.add(anchor)
    }
  }, [anchor, scene])

  // 每帧同步位置/旋转/缩放
  useFrame(() => {
    const cfg = INDUSTRIAL_MODELS[brand]
    anchor.position.set(position[0], position[1] + cfg.liftY, position[2])
    anchor.rotation.set(rotation[0], rotation[1], rotation[2])
    anchor.scale.setScalar(scale * cfg.scale)
  })

  // 关节角度同步
  useEffect(() => {
    const robot = robotCache[brand]
    if (!robot) return
    const cfg = INDUSTRIAL_MODELS[brand]
    const values = telemetryToUrdfJoints(joints, cfg)
    try {
      robot.setJointValues(values)
    } catch (err) {
      // setJointValues 可能因关节名不匹配报错，打日志不崩溃
      console.warn(`[IndustrialRobotModel] ${brand} 设置关节失败:`, err)
    }
  }, [brand, joints])

  if (!ready) {
    return null
  }

  return null
}
