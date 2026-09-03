import type { UnifiedAlert, UnifiedRobotState } from 'robot-adapter-kit'

export type RobotStateSource = (robotId: string) => UnifiedRobotState | null | undefined
export type AlertSource = (robotId?: string) => UnifiedAlert[]

// 默认实现返回空，避免 agent-kit 直接依赖 web-console 的 store
// 实际来源由 web-console 启动时通过 setRobotStateSource / setAlertSource 注入
let robotStateSourceImpl: RobotStateSource = () => null
let alertSourceImpl: AlertSource = () => []

// 注入机器人状态来源，一般是 web-console 的 store
export function setRobotStateSource(fn: RobotStateSource): void {
  robotStateSourceImpl = fn
}

// 注入告警来源
export function setAlertSource(fn: AlertSource): void {
  alertSourceImpl = fn
}

// 读一个机器人的状态
export function getRobotState(robotId: string): UnifiedRobotState | null | undefined {
  return robotStateSourceImpl(robotId)
}

// 读告警列表，不传 robotId 就返回全部
export function getAlerts(robotId?: string): UnifiedAlert[] {
  return alertSourceImpl(robotId)
}
