// mock-control/test/unit/scenario-engine.test.js
// 场景引擎单元测试
import { describe, it, expect, beforeEach } from 'vitest'
import { StateEngine } from '../../server/state-engine.js'
import { CommandHandler } from '../../server/command-handler.js'
import { ScenarioEngine } from '../../server/scenario-engine.js'

class FakeBridge {
  async sendCommand() {}
  async publishAlert() {}
}

async function newScenario() {
  const state = await new StateEngine().init()
  const handler = new CommandHandler(state, new FakeBridge())
  const scenario = new ScenarioEngine(state, handler)
  return { state, handler, scenario }
}

describe('ScenarioEngine', () => {
  let state, handler, scenario
  beforeEach(async () => {
    ;({ state, handler, scenario } = await newScenario())
  })

  it('应列出 4 个预设剧本', () => {
    const list = scenario.list().map((s) => s.name)
    expect(list).toEqual(['full-demo', 'cascade-alarm', 'fault-recovery', 'reset-all'])
  })

  it('full-demo 应完整执行并推进设备状态', async () => {
    const events = []
    scenario.on('scenario', (p) => events.push(p))

    const result = await scenario.run('full-demo', { delayScale: 0 })
    expect(result.completed).toBe(true)

    // 剧本结束时 J2 温度 45 + 告警已清 + 恢复运行
    const fanuc = state.get('FANUC_M20iD_001')
    expect(fanuc.joints[1].temperature).toBe(45)
    expect(fanuc.alarms).toHaveLength(0)
    expect(fanuc.status).toBe('working')
    // 进度事件：0 步 + N 步 + 完成帧
    expect(events.length).toBeGreaterThan(2)
    expect(events.at(-1).label).toBe('完成')
  })

  it('cascade-alarm 应给 4 台设备注入告警', async () => {
    await scenario.run('cascade-alarm', { delayScale: 0 })
    for (const id of ['FANUC_M20iD_001', 'KUKA_KR6_001', 'ESTUN_ER3A_001', 'YASKAWA_GP7_001']) {
      expect(state.get(id).alarms.length).toBeGreaterThan(0)
    }
  })

  it('fault-recovery 结束后设备应无告警且恢复 working', async () => {
    await scenario.run('fault-recovery', { delayScale: 0 })
    const fanuc = state.get('FANUC_M20iD_001')
    expect(fanuc.alarms).toHaveLength(0)
    expect(fanuc.status).toBe('working')
  })

  it('reset-all 应把改动过的设备拉回初始状态', async () => {
    // 先把 G1 电量改坏 + FANUC 注入告警
    await handler.execute({ robotId: 'UNITREE-G1-01', type: 'set_battery', params: { level: 10 } })
    await handler.execute({ robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'SRVO-001', severity: 'error' } })

    await scenario.run('reset-all')
    expect(state.get('UNITREE-G1-01').battery).toBe(85)
    expect(state.get('FANUC_M20iD_001').alarms).toHaveLength(0)
    expect(state.get('FANUC_M20iD_001').status).toBe('working')
  })

  it('未知剧本应报错', async () => {
    await expect(scenario.run('nope')).rejects.toThrow('not found')
  })

  it('执行中不能再启动新剧本', async () => {
    const p = scenario.run('full-demo', { delayScale: 0.01 }) // 慢慢跑
    await expect(scenario.run('cascade-alarm')).rejects.toThrow('执行中')
    await p
  })
})
