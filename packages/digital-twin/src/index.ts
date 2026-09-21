export { RobotViewer } from './RobotViewer'
// 2026-09-07 舰队全景：多机同屏 + 点击聚焦
export { FleetViewer } from './FleetViewer'
export { G1Humanoid, __danceToggle } from './robots/G1Humanoid'
export { G1Dog } from './robots/G1Dog'
export { PeanutBot } from './robots/PeanutBot'
export { FanucArm } from './robots/FanucArm'
export { KukaArm } from './robots/KukaArm'
export { IndustrialRobotModel } from './robots/IndustrialRobotModel'
export {
  INDUSTRIAL_MODELS,
  isIndustrialBrand,
  telemetryToUrdfJoints,
} from './config/industrial-models'
export type { IndustrialBrand, IndustrialModelConfig } from './config/industrial-models'
export { JointPivot, LinkSegment, JointBall } from './robots/JointChain'
export { TrajectoryLine } from './overlays/TrajectoryLine'
export { StatusBadge } from './overlays/StatusBadge'
export { HUDLabel } from './overlays/HUDLabel'
export { StateMachine } from './overlays/StateMachine'
export type { RobotState } from './overlays/StateMachine'
export { SlamMap } from './environment/SlamMap'
// 2026-08-29 室外模式坐标转换
export { lngLatToWorld, routeToWorld } from './map/mapCoords'
export type { MapContext } from './map/mapCoords'
// 原生 three.js G1 加载（非 R3F，用于 AMap GLCustomLayer 等场景）
export { loadG1ForScene } from './robots/nativeG1'
export type { G1LoadResult } from './robots/nativeG1'
