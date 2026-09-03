// Robot-Agent-Kit 对外总入口
// 就是把 agent、编排器、各种 tool 集中导出，业务方只 import 这里就行
export type { Tool, ToolParameterSchema } from './tools/types'

export {
  queryRobotState,
  queryAlarms,
  matchSOP,
  queryHealthScore,
  generateReport,
  pushNotification,
} from './tools'

export {
  queryDockState,
  queryVertiportState,
  setTelemetryQuery,
} from './tools/dock'
export type { TelemetryQueryFn } from './tools/dock'

export {
  setRobotStateSource,
  setAlertSource,
  getRobotState,
  getAlerts,
} from './tools/state-source'
export type { RobotStateSource, AlertSource } from './tools/state-source'

export {
  setSopMatcher,
} from './tools/matchSOP'
export type { SopTemplate, SopStep, SopMatcher } from './tools/matchSOP'

export {
  setNotificationSender,
} from './tools/pushNotification'
export type { NotificationSender } from './tools/pushNotification'

export { ALL_TOOLS, getToolDefinitions, findTool } from './registry'
export { getToolDefinitions as getOrchestratorDefinitions, executeTool } from './orchestrator'
export { runAgent } from './agent'
