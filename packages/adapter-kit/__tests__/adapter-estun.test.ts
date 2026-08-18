import { describe, it, expect } from 'vitest'
import { adaptEstun } from '../src/adapters/industrial/adapter-estun'

// 埃斯顿 Modbus-TCP 遥测帧
const estunFrame = {
  robot_id: 'estun-001',
  model: 'ER20-1700',
  joints: [
    { j: 1, load_pct: 40, temp_c: 38, health_score: 95 },
  ],
  alarms: [
    { raw_code: 'EST-3001' },                 // 已知：OVER_LOAD / warn
    { raw_code: 'EST-3002' },                 // 已知：ENCODER_ERR / error
    { raw_code: 'EST-9999', zh_desc: '自定义故障' }, // 未知 → UNKNOWN / warn
  ],
  runtime: {
    power_on_hours: 5200,
    cycle_count: 18500,
  },
}

describe('adapter-estun · Modbus-TCP → UnifiedRobotState', () => {
  const { state, alerts } = adaptEstun(estunFrame)

  it('基础字段 + 协议标识', () => {
    expect(state.robotId).toBe('estun-001')
    expect(state.brand).toBe('ESTUN')
    expect(state.model).toBe('ER20-1700')
    expect(state.status).toBe('working')
    expect(state.industrial!.protocol).toBe('MODBUS_TCP')
  })

  it('EST 报警码映射为 UDM 编码', () => {
    expect(state.industrial!.alarms[0].udm_code).toBe('OVER_LOAD')
    expect(state.industrial!.alarms[0].severity).toBe('warn')
    expect(state.industrial!.alarms[1].udm_code).toBe('ENCODER_ERR')
    expect(state.industrial!.alarms[1].severity).toBe('error')
  })

  it('未知 raw_code 降级为 UNKNOWN / warn 并保留原始描述', () => {
    const unknown = state.industrial!.alarms[2]
    expect(unknown.udm_code).toBe('UNKNOWN')
    expect(unknown.severity).toBe('warn')
    expect(unknown.zh_desc).toBe('自定义故障')
  })

  it('error 级告警原样保留为 error', () => {
    const encoder = alerts.find((a) => a.code === 'EST-3002')!
    expect(encoder.level).toBe('error')
    expect(encoder.message).toContain('编码器错误')
  })

  it('关节缺省字段补默认值', () => {
    expect(state.industrial!.joints[0].health_score).toBe(95)
    // 未提供 rul_days → undefined
    expect(state.industrial!.joints[0].rul_days).toBeUndefined()
  })

  it('运行时统计缺省字段补默认值', () => {
    // 未提供 operating_hours → undefined
    expect(state.industrial!.runtime.operating_hours).toBeUndefined()
    expect(state.industrial!.runtime.power_on_hours).toBe(5200)
  })
})

describe('adapter-estun · 空 raw 降级', () => {
  it('缺 robot_id 时生成默认 ID', () => {
    const { state } = adaptEstun({})
    expect(state.robotId).toMatch(/^estun-/)
    expect(state.industrial!.joints).toEqual([])
    expect(state.industrial!.runtime.cycle_count).toBe(0)
  })
})
