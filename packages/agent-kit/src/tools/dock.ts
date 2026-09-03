/**
 * 低空 / 机巢专用 Agent Tool
 */
import type { UnifiedRobotState } from 'robot-adapter-kit'
import type { Tool } from './types'

/** 外部注入的遥测查询函数 */
export type TelemetryQueryFn = (robotId: string) => Promise<UnifiedRobotState | null>

let queryTelemetryImpl: TelemetryQueryFn = async () => null

export function setTelemetryQuery(fn: TelemetryQueryFn): void {
  queryTelemetryImpl = fn
}

async function queryTelemetry(robotId: string): Promise<UnifiedRobotState | null> {
  return queryTelemetryImpl(robotId)
}

export const queryDockState: Tool = {
  name: 'queryDockState',
  description: '查询指定无人机机巢/起降场的运行状态、充电状态、气象与告警',
  parameters: {
    type: 'object',
    properties: {
      robot_id: { type: 'string', description: '机巢 ID，如 DJI_DOCK_SN001' },
    },
    required: ['robot_id'],
  },
  async invoke({ robot_id }) {
    const state = await queryTelemetry(robot_id)
    if (!state || state.deviceClass !== 'uav_dock') {
      return { error: 'not a dock device or not found' }
    }
    return {
      dock_state: state.dock!.dockState,
      charger_temp_c: state.dock!.chargerTempC,
      charger_voltage_v: state.dock!.chargerVoltageV,
      charger_current_a: state.dock!.chargerCurrentA,
      door_state: state.dock!.doorState,
      weather: state.dock!.weather,
      has_uav_inside: state.dock!.hasUavInside,
      uav_battery_pct: state.uav?.batteryPct,
      uav_battery_cycles: state.uav?.batteryCycles,
      alarms: state.industrial?.alarms ?? [],
    }
  },
}

export const queryVertiportState: Tool = {
  name: 'queryVertiportState',
  description: '查询 eVTOL 起降场地面设施状态（充电坪/消防/照明）',
  parameters: {
    type: 'object',
    properties: {
      robot_id: { type: 'string', description: '起降场 ID' },
    },
    required: ['robot_id'],
  },
  async invoke({ robot_id }) {
    const state = await queryTelemetry(robot_id)
    if (!state || state.deviceClass !== 'vertiport') {
      return { error: 'not a vertiport device or not found' }
    }
    return state.vertiport
  },
}
