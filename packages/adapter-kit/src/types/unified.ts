// 2026-08-18 设计 UDM 统一模型，解决多品牌字段不一致问题（FOCAS/OPC UA/Modbus 互不通）
// 2026-09-02 低空扩展：将无人机机巢 / eVTOL 起降场 / 边缘网关作为独立 device_class 接入
import type { IndustrialExtension } from './industrial'

// 设备大类：地面机器人 + 低空/地面基建
export type DeviceClass =
  | 'ground_robot'   // 地面工业机器人 / 商用机器人（原有）
  | 'uav_dock'       // 无人机自动机巢
  | 'uav'            // 无人机本体状态（仅遥测，不涉飞控）
  | 'vertiport'      // eVTOL 起降场地面设施
  | 'gateway'        // 通感基站 / 边缘网关

// 机巢运行状态
export type UAVDockState = 'idle' | 'charging' | 'launching' | 'landing' | 'maintenance' | 'fault'

// 无人机本体遥测，不含飞控、航线、载荷
export interface UAVTelemetry {
  batteryPct: number        // 电量 0-100
  batteryCycles: number     // 充放电循环次数
  signalRssi: number        // 图传/数传信号 dBm
  gpsSatellites: number     // 搜星数
  motorTemps: number[]      // 各电机温度 ℃
  propellerRpm: number[]    // 各桨转速
  lastFlightId?: string     // 最近一次飞行任务 ID（仅标识，不含轨迹）
}

// 自动机巢遥测
export interface DockTelemetry {
  dockState: UAVDockState
  chargerTempC: number      // 充电器温度
  chargerVoltageV: number   // 充电电压
  chargerCurrentA: number   // 充电电流
  doorState: 'open' | 'closed' | 'jammed'
  liftPlatform: 'up' | 'down' | 'moving' | 'fault'
  weather: {
    windSpeedMps: number
    windGustMps: number
    rainfallMm: number
    temperatureC: number
    humidityPct: number
  }
  hasUavInside: boolean
}

// eVTOL 起降场地面设施遥测
export interface VertiportTelemetry {
  chargingPadState: 'available' | 'charging' | 'fault'
  chargingCurrentA: number
  fireSuppression: 'armed' | 'discharged' | 'fault'
  lighting: 'on' | 'off' | 'auto'
  groundPowerVoltageV: number
}

export interface UnifiedRobotState {
  robotId: string
  brand: string
  model: string
  batteryPct: number
  voltage: number
  online: boolean
  position: { x: number; y: number; theta: number }
  joints?: Record<string, number>
  status: 'idle' | 'moving' | 'working' | 'error' | 'charging'
  errorCode?: string
  lastSeen: number
  // 工业扩展字段：商用机器人不用传，工业机器人必传
  industrial?: IndustrialExtension
  // 2026-08-29 室外模式扩展
  // indoor: position.x/y 是米；outdoor: position.x=经度, position.y=纬度 (GCJ-02)
  mode?: 'indoor' | 'outdoor'
  // GPS/WGS-84 → GCJ-02 纠偏后的经纬度，室外模式必传
  gps?: {
    lng: number
    lat: number
    alt?: number
    accuracy?: number
    coordsys: 'gcj02'
    heading?: number  // 0-360 正北=0（度）
    speed?: number    // m/s
  }
  // 2026-09-02 设备分类，默认 ground_robot
  deviceClass?: DeviceClass
  // 无人机本体遥测，device_class='uav' 或机巢内无人机时填充
  uav?: UAVTelemetry
  // 自动机巢遥测，device_class='uav_dock'
  dock?: DockTelemetry
  // eVTOL 起降场地面设施遥测，device_class='vertiport'
  vertiport?: VertiportTelemetry
}

// 低空 / 机巢统一告警码命名空间
export const UAV_ALARM_CODES = {
  DOCK_CHARGER_OVER_TEMP: 'UAV_DOCK_CHARGER_OVER_TEMP',
  DOCK_DOOR_JAMMED: 'UAV_DOCK_DOOR_JAMMED',
  DOCK_LIFT_FAULT: 'UAV_DOCK_LIFT_FAULT',
  UAV_BATTERY_LOW: 'UAV_BATTERY_LOW',
  UAV_MOTOR_OVER_TEMP: 'UAV_MOTOR_OVER_TEMP',
  UAV_SIGNAL_WEAK: 'UAV_SIGNAL_WEAK',
  VERTIPORT_FIRE_FAULT: 'VERTIPORT_FIRE_FAULT',
  VERTIPORT_PAD_FAULT: 'VERTIPORT_PAD_FAULT',
} as const

// 2026-08-18 统一告警模型，所有品牌告警码翻译为 info/warn/error 三级
export interface UnifiedAlert {
  robotId: string
  level: 'info' | 'warn' | 'error'
  code: string
  message: string
  timestamp: number
}

// 2026-08-18 统一任务指令模型，商用机器人下发用（工业只读）
export interface UnifiedCommand {
  robotId: string
  action: 'move' | 'speak' | 'dock' | 'stop' | 'custom'
  payload: Record<string, any>
}
