import { describe, it, expect } from 'vitest'
import { adaptDJIDock } from '../src/adapters/aerial/adapter-dji-dock'
import { UAV_ALARM_CODES } from '../src/types/unified'

describe('adapter-dji-dock', () => {
  it('应正确映射常规机巢状态', () => {
    const raw = {
      sn: 'SN001',
      product_version: 'Dock 2',
      dock_state: 'charging',
      charger_temperature_c: 45,
      charger_voltage_v: 24,
      charger_current_a: 2.5,
      door_state: 'closed',
      lift_platform_state: 'down',
      wind_speed: 3.2,
      wind_gust_mps: 5.1,
      rainfall_mm: 0,
      temperature_c: 28,
      humidity_pct: 65,
      uav_inside: true,
      uav: {
        battery_percent: 78,
        battery_cycles: 132,
        signal_rssi: -62,
        gps_satellites: 12,
        motor_temperatures: [42, 41, 43, 40],
        propeller_rpms: [7200, 7180, 7220, 7190],
        last_flight_id: 'FLIGHT_001',
      },
    }

    const { state, alerts } = adaptDJIDock(raw)

    expect(state.robotId).toBe('DJI_DOCK_SN001')
    expect(state.brand).toBe('dji-dock')
    expect(state.deviceClass).toBe('uav_dock')
    expect(state.dock?.dockState).toBe('charging')
    expect(state.dock?.chargerTempC).toBe(45)
    expect(state.uav?.batteryPct).toBe(78)
    expect(alerts.length).toBe(0)
  })

  it('充电器过温应生成告警', () => {
    const { alerts } = adaptDJIDock({
      sn: 'SN002',
      charger_temperature_c: 65,
      door_state: 'closed',
    })
    expect(alerts.some((a) => a.code === UAV_ALARM_CODES.DOCK_CHARGER_OVER_TEMP)).toBe(true)
    expect(alerts[0].level).toBe('error')
  })

  it('舱门卡死应生成 critical 告警', () => {
    const { alerts } = adaptDJIDock({
      sn: 'SN003',
      door_state: 'jammed',
    })
    expect(alerts.some((a) => a.code === UAV_ALARM_CODES.DOCK_DOOR_JAMMED)).toBe(true)
  })

  it('无人机电量低应生成告警', () => {
    const { alerts } = adaptDJIDock({
      sn: 'SN004',
      uav: { battery_percent: 10, signal_rssi: -60 },
    })
    expect(alerts.some((a) => a.code === UAV_ALARM_CODES.UAV_BATTERY_LOW)).toBe(true)
  })
})
