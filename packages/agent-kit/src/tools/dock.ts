// 低空机巢和起降场专用的 agent tool
// 遥测查询函数由外部注入，agent-kit 不直接依赖 store
import type { UnifiedRobotState } from 'robot-adapter-kit'
import type { Tool } from './types'

// 外部注入的遥测查询函数签名
export type TelemetryQueryFn = (robotId: string) => Promise<UnifiedRobotState | null>

// 默认返回空，运行时在 web-console 中注入真实的遥测查询
// 这样 agent-kit 不直接依赖任何 store / HTTP 客户端
let queryTelemetryImpl: TelemetryQueryFn = async () => null

// 注入真实的遥测查询函数，web-console 启动时会设
export function setTelemetryQuery(fn: TelemetryQueryFn): void {
  queryTelemetryImpl = fn
}

// 内部统一查询入口
async function queryTelemetry(robotId: string): Promise<UnifiedRobotState | null> {
  return queryTelemetryImpl(robotId)
}

// 查询机巢状态
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

// 查询起降场状态
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
