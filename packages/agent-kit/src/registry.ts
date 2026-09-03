/**
 * Agent Tool 注册表
 */
import type { Tool } from './tools/types'
import { queryRobotState } from './tools/queryRobotState'
import { queryAlarms } from './tools/queryAlarms'
import { matchSOP } from './tools/matchSOP'
import { queryHealthScore } from './tools/queryHealthScore'
import { generateReport } from './tools/generateReport'
import { pushNotification } from './tools/pushNotification'
import { queryDockState, queryVertiportState } from './tools/dock'

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

export function getToolDefinitions(): Tool[] {
  return ALL_TOOLS
}

export function findTool(name: string): Tool | undefined {
  return ALL_TOOLS.find((t) => t.name === name)
}
