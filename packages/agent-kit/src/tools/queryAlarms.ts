import type { Tool } from './types'
import { getRobotState, getAlerts } from './state-source'

export const queryAlarms: Tool = {
  name: 'queryAlarms',
  description: '查询机器人告警列表，可按严重等级过滤；返回时按 udm_code 聚类去重',
  parameters: {
    type: 'object',
    properties: {
      robot_id: { type: 'string', description: '机器人 ID' },
      severity: { type: 'string', enum: ['info', 'warn', 'error', 'critical'], description: '可选过滤等级' },
    },
    required: ['robot_id'],
  },
  async invoke(args: Record<string, any>) {
    const { robot_id, severity } = args
    const state = getRobotState(robot_id)
    const industrialAlarms = state?.industrial?.alarms ?? []
    const streamAlerts = getAlerts(robot_id)

    // 合并工业告警与实时流告警，去重（按 code + timestamp）
    const all = [
      ...industrialAlarms.map((a) => ({
        level: a.severity,
        code: a.udm_code || a.raw_code,
        message: a.zh_desc || a.raw_code,
        timestamp: new Date(a.occurred_at).getTime() || Date.now(),
        cleared: a.cleared,
      })),
      ...streamAlerts.map((a) => ({
        level: a.level,
        code: a.code,
        message: a.message,
        timestamp: a.timestamp,
        cleared: false,
      })),
    ]

    const filtered = severity ? all.filter((a) => a.level === severity) : all
    const active = filtered.filter((a) => !a.cleared)

    const groups = new Map<string, typeof active>()
    active.forEach((a) => {
      if (!groups.has(a.code)) groups.set(a.code, [])
      groups.get(a.code)!.push(a)
    })

    const clustered = Array.from(groups.entries()).map(([code, list]) => ({
      code,
      count: list.length,
      sample: list[0],
    }))

    return {
      robot_id,
      total: active.length,
      clustered,
    }
  },
}
