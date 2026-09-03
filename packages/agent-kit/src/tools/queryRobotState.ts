import type { Tool } from './types'
import { getRobotState } from './state-source'

// 查询机器人当前运行状态，给 agent 或 UI 用
export const queryRobotState: Tool = {
  name: 'queryRobotState',
  description: '查询指定机器人的当前运行状态（健康分/关节数据/运行时间/告警数）',
  parameters: {
    type: 'object',
    properties: {
      robot_id: { type: 'string', description: '机器人 ID，如 FANUC_M20iD_001' },
    },
    required: ['robot_id'],
  },
  async invoke(args: Record<string, any>) {
    const { robot_id } = args
    const state = getRobotState(robot_id)
    if (!state) return { error: `未找到机器人 ${robot_id}` }

    const joints = state.industrial?.joints ?? []
    // 关节没有 health_score 时按 100 算，避免缺数据拉低平均分
    const avgHealth = joints.length
      ? joints.reduce((sum, j) => sum + (j.health_score ?? 100), 0) / joints.length
      : 100
    const activeAlarms = (state.industrial?.alarms ?? []).filter((a) => !a.cleared)

    return {
      robot_id: state.robotId,
      brand: state.brand,
      model: state.model,
      device_class: state.deviceClass ?? 'ground_robot',
      status: state.status,
      online: state.online,
      battery_pct: state.batteryPct,
      health_score: Math.round(avgHealth),
      joint_count: joints.length,
      alarm_count: activeAlarms.length,
      runtime_hours: state.industrial?.runtime.power_on_hours ?? 0,
      position: state.position,
    }
  },
}
