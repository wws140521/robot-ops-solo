// Agent Tool 注册表，所有 tool 集中在这里登记
// 要加新 tool：先写文件，再 import，最后往 ALL_TOOLS 数组里塞一个
// 顺序无所谓，LLM 按 name 调用
import { queryRobotState } from './tools/queryRobotState'
import { queryAlarms } from './tools/queryAlarms'
import { matchSOP } from './tools/matchSOP'
import { queryHealthScore } from './tools/queryHealthScore'
import { generateReport } from './tools/generateReport'
import { pushNotification } from './tools/pushNotification'
import { queryDockState, queryVertiportState } from './tools/dock'
import type { Tool } from './tools/types'

export const ALL_TOOLS: Tool[] = [
  queryRobotState,
  queryAlarms,
  matchSOP,
  queryHealthScore,
  generateReport,
  pushNotification,
  queryDockState,
  queryVertiportState,
]

// 返回全部 tool，给 LLM 看
export function getToolDefinitions(): Tool[] {
  return ALL_TOOLS
}

// 按名字找 tool，name 必须完全一致，LLM 写错就让它重试
export function findTool(name: string): Tool | undefined {
  // 按 name 精确匹配；LLM 有时会带多余空格，这里不做 trim 以免破坏命名约定
  return ALL_TOOLS.find((t) => t.name === name)
}
