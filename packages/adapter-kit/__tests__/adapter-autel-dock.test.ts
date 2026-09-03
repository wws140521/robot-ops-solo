import { describe, it, expect } from 'vitest'
import { adaptAutelDock } from '../src/adapters/aerial/adapter-autel-dock'
import { UAV_ALARM_CODES } from '../src/types/unified'

describe('adapter-autel-dock', () => {
  it('应正确映射 MAVLink 归一化数据', () => {
    const { state, alerts } = adaptAutelDock({
      id: 'A001',
      model: 'Kemov K10',
      state: 'idle',
      charger_temp_c: 40,
      charger_v: 24,
      charger_a: 1.2,
      door_jammed: false,
      door_open: false,
      lift_fault: false,
      wind: 2.5,
      temp: 30,
      humidity: 55,
      uav_inside: false,
    })

    expect(state.robotId).toBe('AUTEL_DOCK_A001')
    expect(state.deviceClass).toBe('uav_dock')
    expect(state.dock?.dockState).toBe('idle')
    expect(alerts.length).toBe(0)
  })

  it('舱门卡死应生成告警', () => {
    const { alerts } = adaptAutelDock({ id: 'A002', door_jammed: true })
    expect(alerts.some((a) => a.code === UAV_ALARM_CODES.DOCK_DOOR_JAMMED)).toBe(true)
  })
})
