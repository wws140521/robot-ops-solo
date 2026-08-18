import { describe, it, expect } from 'vitest'
import { adaptKuka } from '../src/adapters/industrial/adapter-kuka'

// KUKA OPC UA 遥测帧（alarms 仅含 raw_code，由 ALARM_MAP 映射）
const kukaFrame = {
  robot_id: 'kuka-001',
  model: 'KR 16',
  joints: [
    { j: 1, load_pct: 55, temp_c: 41, health_score: 88 },
    { j: 2, load_pct: 90, temp_c: 58, health_score: 70, rul_days: 60 },
  ],
  alarms: [
    { raw_code: 'KSS15002' },                 // 已知：DRIVE_FAULT / error
    { raw_code: 'KSS15202' },                 // 已知：BREAKER_OPEN / critical
    { raw_code: 'KSS99999', zh_desc: '未知' }, // 未知 → UNKNOWN / warn
  ],
  runtime: {
    power_on_hours: 8800,
    cycle_count: 32000,
    last_maintenance_at: '2026-01-15T00:00:00Z',
  },
}

describe('adapter-kuka · OPC UA → UnifiedRobotState', () => {
  const { state, alerts } = adaptKuka(kukaFrame)

  it('基础字段 + 协议标识', () => {
    expect(state.robotId).toBe('kuka-001')
    expect(state.brand).toBe('KUKA')
    expect(state.model).toBe('KR 16')
    expect(state.status).toBe('working')
    expect(state.industrial!.protocol).toBe('OPC_UA')
  })

  it('KSS 报警码映射为 UDM 编码', () => {
    expect(state.industrial!.alarms[0].udm_code).toBe('DRIVE_FAULT')
    expect(state.industrial!.alarms[0].severity).toBe('error')
    expect(state.industrial!.alarms[1].udm_code).toBe('BREAKER_OPEN')
    expect(state.industrial!.alarms[1].severity).toBe('critical')
  })

  it('未知 raw_code 降级为 UNKNOWN / warn', () => {
    const unknown = state.industrial!.alarms[2]
    expect(unknown.udm_code).toBe('UNKNOWN')
    expect(unknown.severity).toBe('warn')
    expect(unknown.zh_desc).toBe('未知')
  })

  it('critical 告警在 UnifiedAlert 中降级为 error', () => {
    expect(alerts).toHaveLength(3)
    const breaker = alerts.find((a) => a.code === 'KSS15202')!
    expect(breaker.level).toBe('error')
  })

  it('末次保养时间透传', () => {
    expect(state.industrial!.runtime.last_maintenance_at).toBe('2026-01-15T00:00:00Z')
  })
})

describe('adapter-kuka · 空 raw 降级', () => {
  it('无 alarms 时 alerts 为空数组', () => {
    const { alerts, state } = adaptKuka({ robot_id: 'kuka-002' })
    expect(alerts).toEqual([])
    expect(state.industrial!.alarms).toEqual([])
    expect(state.robotId).toBe('kuka-002')
  })
})
