// mock-control/test/unit/command-handler.test.js
// 指令处理器单元测试（对齐文档 §11.1）
import { describe, it, expect, beforeEach } from 'vitest'
import { StateEngine } from '../../server/state-engine.js'
import { CommandHandler } from '../../server/command-handler.js'

// 测试用假桥：记录指令，模拟下发
class FakeBridge {
  constructor() {
    this.commands = []
    this.alerts = []
  }
  async sendCommand(command) { this.commands.push(command) }
  async publishAlert(alert) { this.alerts.push(alert) }
}

async function newHandler() {
  const state = await new StateEngine().init()
  const bridge = new FakeBridge()
  const handler = new CommandHandler(state, bridge)
  return { state, bridge, handler }
}

describe('CommandHandler · 校验', () => {
  let state, bridge, handler
  beforeEach(async () => {
    ;({ state, bridge, handler } = await newHandler())
  })

  it('非法指令类型应抛 ZodError', async () => {
    await expect(handler.execute({ robotId: 'FANUC_M20iD_001', type: 'fly_to_moon' }))
      .rejects.toThrow()
  })

  it('不存在的设备应抛 404 错误', async () => {
    await expect(handler.execute({ robotId: 'NOPE-999', type: 'start' }))
      .rejects.toThrow('not found')
  })

  it('set_battery 参数类型错误应抛 ZodError', async () => {
    await expect(handler.execute({ robotId: 'UNITREE-G1-01', type: 'set_battery', params: { level: '很多' } }))
      .rejects.toThrow()
  })

  it('set_joint_temperature axis 越界应抛 ZodError', async () => {
    await expect(handler.execute({
      robotId: 'FANUC_M20iD_001', type: 'set_joint_temperature',
      params: { axis: 9, temperature: 50 },
    })).rejects.toThrow()
  })
})

describe('CommandHandler · 执行', () => {
  let state, bridge, handler
  beforeEach(async () => {
    ;({ state, bridge, handler } = await newHandler())
  })

  it('set_battery 应生效并下发桥接', async () => {
    const result = await handler.execute({ robotId: 'UNITREE-G1-01', type: 'set_battery', params: { level: 42 } })
    expect(result.success).toBe(true)
    expect(result.state.battery).toBe(42)
    expect(bridge.commands).toHaveLength(1)
    expect(bridge.commands[0].type).toBe('set_battery')
  })

  it('trigger_alarm 应额外发布告警广播', async () => {
    await handler.execute({ robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'SRVO-001' } })
    expect(bridge.alerts).toHaveLength(1)
    expect(bridge.alerts[0].zh_desc).toBe('伺服放大器过流')
    expect(bridge.alerts[0].severity).toBe('warn')
  })

  it('批量指令：部分失败不中断', async () => {
    const result = await handler.executeBatch([
      { robotId: 'UNITREE-G1-01', type: 'set_battery', params: { level: 50 } },
      { robotId: 'GHOST-01', type: 'start' },
      { robotId: 'FANUC_M20iD_001', type: 'set_joint_temperature', params: { axis: 2, temperature: 75 } },
    ])
    expect(result.results).toHaveLength(3)
    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(false)
    expect(result.results[2].success).toBe(true)
    expect(result.success).toBe(false)
  })

  it('指令应带服务端时间戳', async () => {
    await handler.execute({ robotId: 'UNITREE-G1-01', type: 'start' })
    expect(bridge.commands[0].ts).toBeGreaterThan(0)
  })
})
