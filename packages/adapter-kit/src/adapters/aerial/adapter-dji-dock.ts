/**
 * DJI Dock 2/3 适配器
 * 输入：大疆机场开放 API 返回的 JSON（经边缘侧 fetch 或 webhook）
 * 输出：UDM UnifiedRobotState + 告警
 */
import type { UnifiedRobotState, UnifiedAlert, UAV_ALARM_CODES } from '../../types/unified'

type AlarmCode = typeof UAV_ALARM_CODES[keyof typeof UAV_ALARM_CODES]
type DockState = NonNullable<UnifiedRobotState['dock']>['dockState']
type DockDoorState = NonNullable<UnifiedRobotState['dock']>['doorState']
type DockLiftState = NonNullable<UnifiedRobotState['dock']>['liftPlatform']

export function adaptDJIDock(raw: any): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const dock = raw.dock ?? raw
  const uav = raw.uav ?? null

  const robotId = `DJI_DOCK_${raw.sn ?? raw.dockSn ?? 'UNKNOWN'}`
  const model = raw.productVersion ?? raw.product_version ?? 'Dock 2'

  const alarms: UnifiedAlert[] = []

  const pushAlarm = (code: AlarmCode, level: 'info' | 'warn' | 'error', message: string) => {
    alarms.push({ robotId, level, code, message, timestamp: Date.now() })
  }

  if ((dock.chargerTemperatureC ?? dock.charger_temperature_c ?? 0) > 60) {
    pushAlarm('UAV_DOCK_CHARGER_OVER_TEMP', 'error', '机巢充电器过温')
  }
  if ((dock.doorState ?? dock.door_state) === 'jammed') {
    pushAlarm('UAV_DOCK_DOOR_JAMMED', 'error', '机巢舱门卡死')
  }
  if ((dock.liftFault ?? dock.lift_fault) === true) {
    pushAlarm('UAV_DOCK_LIFT_FAULT', 'error', '升降平台故障')
  }
  if ((uav?.batteryPercent ?? uav?.battery_percent ?? 100) < 15) {
    pushAlarm('UAV_BATTERY_LOW', 'warn', '无人机电量低')
  }
  if ((uav?.motorTemperatures ?? uav?.motor_temperatures ?? []).some((t: number) => t > 75)) {
    pushAlarm('UAV_MOTOR_OVER_TEMP', 'warn', '无人机电机过温')
  }
  if ((uav?.signalRssi ?? uav?.signal_rssi ?? -50) < -85) {
    pushAlarm('UAV_SIGNAL_WEAK', 'warn', '无人机图传信号弱')
  }

  const dockState = (dock.dockState ?? dock.dock_state ?? 'idle') as DockState

  const state: UnifiedRobotState = {
    robotId,
    brand: 'dji-dock',
    model,
    batteryPct: uav?.batteryPercent ?? uav?.battery_percent ?? 0,
    voltage: dock.chargerVoltageV ?? dock.charger_voltage_v ?? 0,
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
      chargerTempC: dock.chargerTemperatureC ?? dock.charger_temperature_c ?? 0,
      chargerVoltageV: dock.chargerVoltageV ?? dock.charger_voltage_v ?? 0,
      chargerCurrentA: dock.chargerCurrentA ?? dock.charger_current_a ?? 0,
      doorState: (dock.doorState ?? dock.door_state ?? 'closed') as DockDoorState,
      liftPlatform: (dock.liftPlatformState ?? dock.lift_platform_state ?? 'down') as DockLiftState,
      weather: {
        windSpeedMps: dock.windSpeed ?? dock.wind_speed ?? 0,
        windGustMps: dock.windGust ?? dock.wind_gust ?? 0,
        rainfallMm: dock.rainfall ?? dock.rainfall_mm ?? 0,
        temperatureC: dock.temperature ?? dock.temperature_c ?? 0,
        humidityPct: dock.humidity ?? dock.humidity_pct ?? 0,
      },
      hasUavInside: dock.uavInside ?? dock.uav_inside ?? false,
    },
    uav: uav ? {
      batteryPct: uav.batteryPercent ?? uav.battery_percent ?? 0,
      batteryCycles: uav.batteryCycles ?? uav.battery_cycles ?? 0,
      signalRssi: uav.signalRssi ?? uav.signal_rssi ?? -90,
      gpsSatellites: uav.gpsSatellites ?? uav.gps_satellites ?? 0,
      motorTemps: uav.motorTemperatures ?? uav.motor_temperatures ?? [],
      propellerRpm: uav.propellerRpms ?? uav.propeller_rpms ?? [],
      lastFlightId: uav.lastFlightId ?? uav.last_flight_id,
    } : undefined,
  }

  return { state, alerts: alarms }
}
