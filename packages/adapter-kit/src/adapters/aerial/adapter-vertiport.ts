/**
 * eVTOL 起降场适配器
 * 输入：起降场地面设施 BACnet / Modbus / 厂商 API 数据
 */
import type { UnifiedRobotState, UnifiedAlert, UAV_ALARM_CODES } from '../../types/unified'

type AlarmCode = typeof UAV_ALARM_CODES[keyof typeof UAV_ALARM_CODES]
type VertiportPadState = NonNullable<UnifiedRobotState['vertiport']>['chargingPadState']
type VertiportFireState = NonNullable<UnifiedRobotState['vertiport']>['fireSuppression']
type VertiportLightingState = NonNullable<UnifiedRobotState['vertiport']>['lighting']

export function adaptVertiport(raw: any): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const robotId = `VERTIPORT_${raw.id ?? raw.siteId ?? 'UNKNOWN'}`
  const alarms: UnifiedAlert[] = []

  const pushAlarm = (code: AlarmCode, level: 'info' | 'warn' | 'error', message: string) => {
    alarms.push({ robotId, level, code, message, timestamp: Date.now() })
  }

  if ((raw.fireSuppressionState ?? raw.fire_suppression_state) === 'fault') {
    pushAlarm('VERTIPORT_FIRE_FAULT', 'error', '起降场消防故障')
  }
  if ((raw.chargingPadState ?? raw.charging_pad_state) === 'fault') {
    pushAlarm('VERTIPORT_PAD_FAULT', 'error', '充电坪故障')
  }

  const state: UnifiedRobotState = {
    robotId,
    brand: 'generic-vertiport',
    model: raw.model ?? 'Vertiport Ground System',
    batteryPct: 0,
    voltage: raw.groundPowerV ?? raw.ground_power_v ?? 0,
    online: true,
    position: { x: 0, y: 0, theta: 0 },
    status: alarms.some((a) => a.level === 'error') ? 'error' : 'idle',
    lastSeen: Date.now(),
    deviceClass: 'vertiport',
    vertiport: {
      chargingPadState: (raw.chargingPadState ?? raw.charging_pad_state ?? 'available') as VertiportPadState,
      chargingCurrentA: raw.chargingCurrentA ?? raw.charging_current_a ?? 0,
      fireSuppression: (raw.fireSuppressionState ?? raw.fire_suppression_state ?? 'armed') as VertiportFireState,
      lighting: (raw.lighting ?? 'auto') as VertiportLightingState,
      groundPowerVoltageV: raw.groundPowerV ?? raw.ground_power_v ?? 0,
    },
  }

  return { state, alerts: alarms }
}
