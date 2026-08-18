import { describe, it, expect } from 'vitest'
import { adaptFanuc } from '../src/adapters/industrial/adapter-fanuc'
import { adaptByBrandEnhanced } from '../src/adapters'

// FANUC FOCAS 遥测帧（含 6 轴关节 + 1 条告警 + 运行时统计）
const fanucFrame = {
  robot_id: 'fanuc-001',
  model: 'M-20iA',
  joints: [
    { j: 1, load_pct: 65, temp_c: 45, current_a: 12.3, speed_rpm: 1500, health_score: 92, rul_days: 180 },
    { j: 2, load_pct: 78, temp_c: 52 },
  ],
  alarms: [
    { raw_code: 'SRVO-023', udm_code: 'OVER_TEMP_J2', severity: 'warn', zh_desc: 'J2 轴过热' },
    { raw_code: 'SRVO-050', udm_code: 'BRAKE_FAULT', severity: 'critical', zh_desc: '制动器故障' },
  ],
  runtime: {
    power_on_hours: 12000,
    operating_hours: 9500,
    cycle_count: 58000,
    payload_kg: 8.5,
  },
}

describe('adapter-fanuc · FOCAS → UnifiedRobotState', () => {
  const { state, alerts } = adaptFanuc(fanucFrame)

  it('基础字段归一化', () => {
    expect(state.robotId).toBe('fanuc-001')
    expect(state.brand).toBe('FANUC')
    expect(state.model).toBe('M-20iA')
    expect(state.online).toBe(true)
    expect(state.status).toBe('working')
    // 工业机器人无电池概念，固定 0
    expect(state.batteryPct).toBe(0)
    expect(state.voltage).toBe(0)
  })

  it('关节遥测映射（缺省字段补默认值）', () => {
    expect(state.industrial!.joints).toHaveLength(2)
    expect(state.industrial!.joints[0]).toMatchObject({
      j: 1, load_pct: 65, temp_c: 45, health_score: 92, rul_days: 180,
    })
    // J2 未提供 health_score → 默认 100
    expect(state.industrial!.joints[1].health_score).toBe(100)
    expect(state.industrial!.joints[1].load_pct).toBe(78)
  })

  it('告警转为 UnifiedAlert，critical 降级为 error', () => {
    expect(alerts).toHaveLength(2)
    const warn = alerts.find((a) => a.code === 'SRVO-023')!
    expect(warn.level).toBe('warn')
    expect(warn.message).toContain('J2 轴过热')
    const critical = alerts.find((a) => a.code === 'SRVO-050')!
    // critical 在 UnifiedAlert 中不存在，降级为 error
    expect(critical.level).toBe('error')
  })

  it('运行时统计透传', () => {
    expect(state.industrial!.runtime.power_on_hours).toBe(12000)
    expect(state.industrial!.runtime.cycle_count).toBe(58000)
    expect(state.industrial!.runtime.payload_kg).toBe(8.5)
  })

  it('协议标识为 FOCAS', () => {
    expect(state.industrial!.protocol).toBe('FOCAS')
  })
})

describe('adapter-fanuc · 空 raw 降级', () => {
  it('无 joints/alarms 时空数组而非 undefined', () => {
    const { state, alerts } = adaptFanuc({ robot_id: 'fanuc-002' })
    expect(state.industrial!.joints).toEqual([])
    expect(alerts).toEqual([])
    expect(state.industrial!.runtime.cycle_count).toBe(0)
    expect(state.industrial!.runtime.power_on_hours).toBe(0)
  })

  it('缺 robot_id 时生成默认 ID', () => {
    const { state } = adaptFanuc({})
    expect(state.robotId).toMatch(/^fanuc-/)
  })
})

describe('adaptByBrandEnhanced · fanuc 走工业注册表', () => {
  it('品牌小写分发到 adaptFanuc', () => {
    const { state } = adaptByBrandEnhanced('fanuc', fanucFrame)
    expect(state.brand).toBe('FANUC')
    expect(state.industrial!.protocol).toBe('FOCAS')
  })
})
