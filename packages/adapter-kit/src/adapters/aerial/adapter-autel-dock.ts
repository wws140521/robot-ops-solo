/**
 * 科比特 / 普宙 / 道通机巢适配器（Autel 兼容 MAVLink）
 * 输入：MAVLink / 厂商 REST API 归一化后的 JSON
 * 说明：科比特、普宙、道通等国产机巢多走 MAVLink 或私有 REST，
 *       边缘侧先归一化为统一 raw 结构，此处仅做 UDM 映射。
 */
import type { UnifiedRobotState, UnifiedAlert, UAV_ALARM_CODES } from '../../types/unified'

type AlarmCode = typeof UAV_ALARM_CODES[keyof typeof UAV_ALARM_CODES]
type DockState = NonNullable<UnifiedRobotState['dock']>['dockState']
type DockDoorState = NonNullable<UnifiedRobotState['dock']>['doorState']
type DockLiftState = NonNullable<UnifiedRobotState['dock']>['liftPlatform']

export function adaptAutelDock(raw: any): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const robotId = `AUTEL_DOCK_${raw.id ?? raw.dockId ?? 'UNKNOWN'}`
  const alarms: UnifiedAlert[] = []

  const pushAlarm = (code: AlarmCode, level: 'info' | 'warn' | 'error', message: string) => {
    alarms.push({ robotId, level, code, message, timestamp: Date.now() })
  }

  if ((raw.chargerTempC ?? raw.charger_temp_c ?? 0) > 60) {
    pushAlarm('UAV_DOCK_CHARGER_OVER_TEMP', 'error', '机巢充电器过温')
  }
  if (raw.doorJammed ?? raw.door_jammed) {
    pushAlarm('UAV_DOCK_DOOR_JAMMED', 'error', '机巢舱门卡死')
  }
  if (raw.liftFault ?? raw.lift_fault) {
    pushAlarm('UAV_DOCK_LIFT_FAULT', 'error', '升降平台故障')
  }
  if ((raw.uavBatteryPct ?? raw.uav_battery_pct ?? 100) < 15) {
    pushAlarm('UAV_BATTERY_LOW', 'warn', '无人机电量低')
  }

  const dockState = (raw.state ?? raw.dock_state ?? 'idle') as DockState

  const state: UnifiedRobotState = {
    robotId,
    brand: 'autel-dock',
    model: raw.model ?? 'Generic MAVLink Dock',
    batteryPct: raw.uavBatteryPct ?? raw.uav_battery_pct ?? 0,
    voltage: raw.chargerV ?? raw.charger_v ?? 0,
    online: true,
    position: { x: 0, y: 0, theta: 0 },
    status: alarms.some((a) => a.level === 'error') ? 'error'
      : dockState === 'maintenance' ? 'idle'
      : dockState === 'charging' ? 'charging'
      : 'idle',
    lastSeen: Date.now(),
    deviceClass: 'uav_dock',
    dock: {
      dockState,
      chargerTempC: raw.chargerTempC ?? raw.charger_temp_c ?? 0,
      chargerVoltageV: raw.chargerV ?? raw.charger_v ?? 0,
      chargerCurrentA: raw.chargerA ?? raw.charger_a ?? 0,
      doorState: doorState(raw),
      liftPlatform: liftState(raw),
      weather: {
        windSpeedMps: raw.wind ?? raw.wind_speed ?? 0,
        windGustMps: raw.windGust ?? raw.wind_gust ?? 0,
        rainfallMm: raw.rain ?? raw.rainfall ?? 0,
        temperatureC: raw.temp ?? raw.temperature ?? 0,
        humidityPct: raw.humidity ?? 0,
      },
      hasUavInside: raw.uavInside ?? raw.uav_inside ?? false,
    },
  }

  return { state, alerts: alarms }
}

function doorState(raw: any): DockDoorState {
  if (raw.doorJammed ?? raw.door_jammed) return 'jammed'
  if (raw.doorOpen ?? raw.door_open) return 'open'
  return 'closed'
}

function liftState(raw: any): DockLiftState {
  if (raw.liftFault ?? raw.lift_fault) return 'fault'
  if (raw.liftUp ?? raw.lift_up) return 'up'
  if (raw.liftMoving ?? raw.lift_moving) return 'moving'
  return 'down'
}
