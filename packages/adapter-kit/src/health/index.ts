/**
 * 健康分统一入口
 * 根据 device_class 路由到对应算法
 */
import type { UnifiedRobotState } from '../types/unified'
import { calcDockHealthScore } from './dock-health'
import { calcVertiportHealthScore } from './vertiport-health'

export { calcDockHealthScore, DOCK_WEIGHTS } from './dock-health'
export type { DockHealthWeights } from './dock-health'
export { calcVertiportHealthScore, VERTIPORT_WEIGHTS } from './vertiport-health'
export type { VertiportHealthWeights } from './vertiport-health'

/**
 * 计算设备健康分
 * - uav_dock → 机巢算法
 * - vertiport → 起降场算法
 * - ground_robot / 默认 → 返回已有 industrial 关节健康分平均值或 85
 */
export function calcHealthScore(state: UnifiedRobotState): number {
  switch (state.deviceClass) {
    case 'uav_dock':
      return state.dock ? calcDockHealthScore(state.dock, state.uav) : 0
    case 'vertiport':
      return state.vertiport ? calcVertiportHealthScore(state.vertiport) : 0
    case 'ground_robot':
    default: {
      const joints = state.industrial?.joints ?? []
      if (joints.length === 0) return 85
      return Math.round(
        joints.reduce((sum, j) => sum + (j.health_score ?? 100), 0) / joints.length
      )
    }
  }
}
