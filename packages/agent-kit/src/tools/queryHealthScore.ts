import type { Tool } from './types'
import { getRobotState } from './state-source'

// 查询健康分，返回整体分和最差的那几个关节
export const queryHealthScore: Tool = {
  name: 'queryHealthScore',
  description: '查询机器人整体健康分及关节级健康分，用于"哪台最该保养"排序',
  parameters: {
    type: 'object',
    properties: {
      robot_id: { type: 'string', description: '机器人 ID' },
      top_n: { type: 'number', description: '返回健康分最低的 N 个关节' },
    },
    required: ['robot_id'],
  },
  async invoke(args: Record<string, any>) {
    const { robot_id, top_n = 3 } = args
    const state = getRobotState(robot_id)
    if (!state) return { error: `未找到机器人 ${robot_id}` }

    const joints = state.industrial?.joints ?? []
    // 按健康分升序，取最差的 top_n 个关节返回；top_n 默认 3 足够定位问题
    const ranked = [...joints]
      .sort((a, b) => (a.health_score ?? 100) - (b.health_score ?? 100))
      .slice(0, top_n)
      .map((j) => ({
        joint: j.j,
        health_score: j.health_score ?? 100,
        rul_days: j.rul_days,
        load_pct: j.load_pct,
        temp_c: j.temp_c,
      }))

    const avgHealth = joints.length
      ? joints.reduce((sum, j) => sum + (j.health_score ?? 100), 0) / joints.length
      : 100

    return {
      robot_id,
      overall_health: Math.round(avgHealth),
      joint_count: joints.length,
      worst_joints: ranked,
    }
  },
}
