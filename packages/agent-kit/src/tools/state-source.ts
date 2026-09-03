import type { UnifiedAlert, UnifiedRobotState } from 'robot-adapter-kit'

export type RobotStateSource = (robotId: string) => UnifiedRobotState | null | undefined
export type AlertSource = (robotId?: string) => UnifiedAlert[]

let robotStateSourceImpl: RobotStateSource = () => null
let alertSourceImpl: AlertSource = () => []

export function setRobotStateSource(fn: RobotStateSource): void {
  robotStateSourceImpl = fn
}

export function setAlertSource(fn: AlertSource): void {
  alertSourceImpl = fn
}

export function getRobotState(robotId: string): UnifiedRobotState | null | undefined {
  return robotStateSourceImpl(robotId)
}

export function getAlerts(robotId?: string): UnifiedAlert[] {
  return alertSourceImpl(robotId)
}
