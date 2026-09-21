// mock-control/test/unit/state-engine.test.js
// 状态引擎单元测试（对齐文档 §11.1）
import { describe, it, expect, beforeEach } from 'vitest'
import { StateEngine } from '../../server/state-engine.js'

async function newEngine() {
  return new StateEngine().init()
}

describe('StateEngine · 初始化', () => {
  it('应加载 6 台设备（商用 2 + 工业 4）', async () => {
    const engine = await newEngine()
    expect(engine.size()).toBe(6)
    expect(engine.getAll().map((d) => d.robotId)).toEqual([
      'UNITREE-G1-01', 'KEENON-T9-01',
      'FANUC_M20iD_001', 'KUKA_KR6_001', 'ESTUN_ER3A_001', 'YASKAWA_GP7_001',
    ])
  })

  it('工业臂应有 6 轴关节 + 空告警列表', async () => {
    const engine = await newEngine()
    const fanuc = engine.get('FANUC_M20iD_001')
    expect(fanuc.joints).toHaveLength(6)
    expect(fanuc.joints[0].axis).toBe(1)
    expect(fanuc.alarms).toEqual([])
  })

  it('工业臂 battery 为 null（真实机械臂无电池）', async () => {
    const engine = await newEngine()
    expect(engine.get('FANUC_M20iD_001').battery).toBeNull()
    expect(engine.get('UNITREE-G1-01').battery).toBe(85)
  })
})

describe('StateEngine · apply()', () => {
  let engine
  beforeEach(async () => {
    engine = await newEngine()
  })

  it('set_battery 应钳位到 0-100', () => {
    engine.apply({ robotId: 'UNITREE-G1-01', type: 'set_battery', params: { level: 150 } })
    expect(engine.get('UNITREE-G1-01').battery).toBe(100)
    engine.apply({ robotId: 'UNITREE-G1-01', type: 'set_battery', params: { level: -10 } })
    expect(engine.get('UNITREE-G1-01').battery).toBe(0)
  })

  it('set_joint_temperature 高温应标记 fault 并重算健康分', () => {
    const before = engine.get('FANUC_M20iD_001').healthScore
    engine.apply({ robotId: 'FANUC_M20iD_001', type: 'set_joint_temperature', params: { axis: 2, temperature: 90 } })
    const after = engine.get('FANUC_M20iD_001')
    expect(after.joints[1].status).toBe('fault')
    expect(after.healthScore).not.toBe(before) // 已按温度公式重算

    // 全关节过热 → 均值 90℃ → 健康分归零（对齐 health/index.ts 思路：每超 1℃ 扣 2 分）
    for (let axis = 1; axis <= 6; axis++) {
      engine.apply({ robotId: 'FANUC_M20iD_001', type: 'set_joint_temperature', params: { axis, temperature: 90 } })
    }
    expect(engine.get('FANUC_M20iD_001').healthScore).toBe(0)
  })

  it('set_joint_temperature 边界：>75 fault，>60 warning，其余 normal', () => {
    const apply = (t) => engine.apply({ robotId: 'KUKA_KR6_001', type: 'set_joint_temperature', params: { axis: 1, temperature: t } })
    apply(80); expect(engine.get('KUKA_KR6_001').joints[0].status).toBe('fault')
    apply(65); expect(engine.get('KUKA_KR6_001').joints[0].status).toBe('warning')
    apply(40); expect(engine.get('KUKA_KR6_001').joints[0].status).toBe('normal')
  })

  it('trigger_alarm 应带中文描述，error 级别联动设备状态', () => {
    engine.apply({ robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'SRVO-001', severity: 'error' } })
    const d = engine.get('FANUC_M20iD_001')
    expect(d.alarms).toHaveLength(1)
    expect(d.alarms[0].zh_desc).toBe('伺服放大器过流')
    expect(d.status).toBe('error')
  })

  it('clear_alarm 清空全部并从 error 恢复 working', () => {
    engine.apply({ robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'SRVO-001', severity: 'error' } })
    engine.apply({ robotId: 'FANUC_M20iD_001', type: 'clear_alarm', params: {} })
    const d = engine.get('FANUC_M20iD_001')
    expect(d.alarms).toHaveLength(0)
    expect(d.status).toBe('working')
  })

  it('clear_alarm 指定 code 只清对应告警', () => {
    engine.apply({ robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'SRVO-001' } })
    engine.apply({ robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'OH-002' } })
    engine.apply({ robotId: 'FANUC_M20iD_001', type: 'clear_alarm', params: { code: 'SRVO-001' } })
    expect(engine.get('FANUC_M20iD_001').alarms.map((a) => a.code)).toEqual(['OH-002'])
  })

  it('reset 应恢复初始状态', () => {
    engine.apply({ robotId: 'UNITREE-G1-01', type: 'set_battery', params: { level: 10 } })
    engine.apply({ robotId: 'UNITREE-G1-01', type: 'reset', params: {} })
    expect(engine.get('UNITREE-G1-01').battery).toBe(85)
  })

  it('未知设备应抛 not found', () => {
    expect(() => engine.apply({ robotId: 'NOPE-999', type: 'start', params: {} })).toThrow('not found')
  })

  it('未知指令类型应抛错', () => {
    expect(() => engine.apply({ robotId: 'FANUC_M20iD_001', type: 'fly_to_moon', params: {} })).toThrow('Unknown command type')
  })

  it('apply 应广播 change 事件', () => {
    let fired = 0
    engine.on('change', () => fired++)
    engine.apply({ robotId: 'FANUC_M20iD_001', type: 'start', params: {} })
    expect(fired).toBe(1)
  })
})

describe('StateEngine · applyTelemetry()', () => {
  it('工业遥测应同步状态/关节且不覆盖健康分', async () => {
    const engine = await newEngine()
    const healthBefore = engine.get('FANUC_M20iD_001').healthScore
    engine.applyTelemetry('FANUC_M20iD_001', {
      status: 'error',
      joints: [
        { axis: 1, angle: 10, temperature: 50, load: 60, current: 3 },
        { axis: 2, angle: 20, temperature: 70, load: 80, current: 5 },
      ],
      alarmEvents: [{ raw_code: 'SRVO-023', severity: 'error', zh_desc: '伺服过载' }],
    })
    const d = engine.get('FANUC_M20iD_001')
    expect(d.status).toBe('error')
    expect(d.joints[1].angle).toBe(20)
    expect(d.joints[1].status).toBe('warning') // 70℃ → warning
    expect(d.healthScore).toBe(healthBefore) // 健康分由本地算法驱动
    expect(d.alarms).toHaveLength(1)
    expect(d.alarms[0].code).toBe('SRVO-023')
  })

  it('未知设备静默忽略', async () => {
    const engine = await newEngine()
    expect(() => engine.applyTelemetry('GHOST-01', { status: 'idle' })).not.toThrow()
  })
})
