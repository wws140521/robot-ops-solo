import type { Tool } from './types'
import { getRobotState, getAlerts } from './state-source'

// 生成机器人健康/维修/保养报告的 Markdown 草稿，给人工确认用
export const generateReport: Tool = {
  name: 'generateReport',
  description: '生成《机器人健康/维修报告》Markdown 草稿（供人工确认后发出）',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['health', 'repair', 'maintenance'], description: '报告类型' },
      robot_id: { type: 'string', description: '机器人 ID' },
    },
    required: ['type', 'robot_id'],
  },
  async invoke(args: Record<string, any>) {
    const { type, robot_id } = args
    const state = getRobotState(robot_id)
    if (!state) return { error: `未找到机器人 ${robot_id}` }

    // 根据用户关键词确定报告标题
    const titleMap: Record<string, string> = {
      health: '健康报告',
      repair: '维修报告',
      maintenance: '保养报告',
    }
    const title = titleMap[type] ?? '运维报告'

    // 同时考虑离线告警库和实时流告警，只统计未清除 / error / warn 级别
    const activeAlarms = (state.industrial?.alarms ?? []).filter((a) => !a.cleared)
    const streamAlerts = getAlerts(robot_id).filter((a) => a.level === 'error' || a.level === 'warn')

    // 计算整体健康分并找出最差关节，用于报告重点提示
    const joints = state.industrial?.joints ?? []
    const avgHealth = joints.length
      ? joints.reduce((sum, j) => sum + (j.health_score ?? 100), 0) / joints.length
      : 100
    const worstJoint = [...joints].sort(
      (a, b) => (a.health_score ?? 100) - (b.health_score ?? 100)
    )[0]

    // 拼接 Markdown，空字符串会在 filter(Boolean) 时被剔除
    const md = [
      `# ${title} · ${robot_id}`,
      `> 生成时间：${new Date().toISOString()}`,
      '',
      `- 品牌型号：${state.brand} ${state.model ?? ''}`,
      `- 设备类型：${state.deviceClass ?? 'ground_robot'}`,
      `- 在线状态：${state.online ? '在线' : '离线'}`,
      `- 当前状态：${state.status}`,
      `- 电池/电量：${state.batteryPct}%`,
      `- 累计运行：${state.industrial?.runtime.power_on_hours ?? 0} 小时`,
      `- 当前告警：${activeAlarms.length + streamAlerts.length} 条`,
      `- 整体健康分：${Math.round(avgHealth)}`,
      worstJoint ? `- 最差关节：J${worstJoint.j}（健康分 ${worstJoint.health_score ?? 100}）` : '',
      '',
      '## 建议',
      '- 本报告由 Agent 根据实时遥测与告警生成，关键操作需人工确认后执行。',
      activeAlarms.length > 0
        ? `- 优先处理告警：${activeAlarms.map((a) => a.udm_code || a.raw_code).join(', ')}`
        : '- 当前无活跃告警，继续保持定期巡检。',
      worstJoint && (worstJoint.rul_days ?? 999) < 30
        ? `- J${worstJoint.j} 剩余寿命仅 ${worstJoint.rul_days} 天，建议安排预防性维护。`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    return { markdown: md, status: 'draft', robot_id }
  },
}
