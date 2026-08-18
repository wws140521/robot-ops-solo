import { describe, it, expect } from 'vitest'
import { adaptUnitree } from '../src/adapters/commercial/adapter-unitree'
import { adaptIncoming } from '../src/adapters'

describe('adapter-unitree', () => {
  it('converts raw msg to unified state', () => {
    const raw = {
      topic: '/battery',
      data: {
        percentage: 75,
        voltage: 54.2,
        position: { x: 1.2, y: 3.4, yaw: 0.5 },
        joints: { hip: 0.1, knee: -0.2 },
      },
    }
    const state = adaptUnitree(raw, 'g1-001')
    expect(state.robotId).toBe('g1-001')
    expect(state.brand).toBe('unitree')
    expect(state.batteryPct).toBe(75)
    expect(state.position.x).toBe(1.2)
    expect(state.joints?.hip).toBe(0.1)
  })

  it('flags low battery as error', () => {
    const raw = { topic: '/battery', data: { percentage: 5, voltage: 48 } }
    const state = adaptUnitree(raw, 'g1-001')
    expect(state.status).toBe('error')
  })
})

describe('adaptIncoming factory', () => {
  it('dispatches by brand', () => {
    const raw = { topic: '/battery', data: { percentage: 60, voltage: 52 } }
    const state = adaptIncoming('unitree', raw, 'g1-002')
    expect(state.brand).toBe('unitree')
  })
})
