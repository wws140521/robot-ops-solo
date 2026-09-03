import { describe, it, expect } from 'vitest'
import { adaptVertiport } from '../src/adapters/aerial/adapter-vertiport'
import { UAV_ALARM_CODES } from '../src/types/unified'

describe('adapter-vertiport', () => {
  it('应正确映射起降场状态', () => {
    const { state, alerts } = adaptVertiport({
      id: 'SZ001',
      model: 'Longhua Vertiport',
      charging_pad_state: 'available',
      charging_current_a: 0,
      fire_suppression_state: 'armed',
      lighting: 'auto',
      ground_power_v: 400,
    })

    expect(state.robotId).toBe('VERTIPORT_SZ001')
    expect(state.deviceClass).toBe('vertiport')
    expect(state.vertiport?.chargingPadState).toBe('available')
    expect(alerts.length).toBe(0)
  })

  it('消防故障应生成告警', () => {
    const { alerts } = adaptVertiport({
      id: 'SZ002',
      fire_suppression_state: 'fault',
    })
    expect(alerts.some((a) => a.code === UAV_ALARM_CODES.VERTIPORT_FIRE_FAULT)).toBe(true)
  })
})
