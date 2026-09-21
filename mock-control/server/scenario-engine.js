// mock-control/server/scenario-engine.js
// 场景剧本引擎：路演用预设脚本，服务端推进（换浏览器 Tab 也不会断）
// 剧本步骤 = 一串 { delay, robotId, type, params }，逐条走 CommandHandler 下发
// 进度通过 EventEmitter 广播 'scenario' 事件，SSE 推给操作页面进度条。

import { EventEmitter } from 'node:events'

// 预设剧本（对齐 doc/mock-control-panel-dev-guide.md §6.2.3 / §9.1）
const SCENARIOS = {
  // 一键演示：负载爬升 → 预警 → 告警 → 恢复（完整运维闭环叙事）
  'full-demo': {
    label: '🚀 一键演示',
    description: 'J2 负载爬升 → 预警 → 告警锁定 → 降温恢复（完整闭环）',
    steps: [
      { delay: 0,    robotId: 'FANUC_M20iD_001', type: 'start' },
      { delay: 2000, robotId: 'FANUC_M20iD_001', type: 'set_joint_temperature', params: { axis: 2, temperature: 68 } },
      { delay: 3000, robotId: 'FANUC_M20iD_001', type: 'set_joint_temperature', params: { axis: 2, temperature: 78 } },
      { delay: 4000, robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'OH-002', severity: 'warn' } },
      { delay: 5000, robotId: 'FANUC_M20iD_001', type: 'set_joint_temperature', params: { axis: 2, temperature: 88 } },
      { delay: 6000, robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'SRVO-023', severity: 'error' } },
      { delay: 8000, robotId: 'FANUC_M20iD_001', type: 'set_joint_temperature', params: { axis: 2, temperature: 45 } },
      { delay: 9000, robotId: 'FANUC_M20iD_001', type: 'clear_alarm' },
      { delay: 10000, robotId: 'FANUC_M20iD_001', type: 'resume' },
    ],
  },

  // 级联告警：4 台工业臂接连报警（考验 AlertsPage 承压 + 值班员分诊）
  'cascade-alarm': {
    label: '⚠️ 级联告警',
    description: '4 台工业臂 1.5s 内接连报警',
    steps: [
      { delay: 0,    robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'SRVO-001', severity: 'error' } },
      { delay: 500,  robotId: 'KUKA_KR6_001',    type: 'trigger_alarm', params: { code: 'KSS-150', severity: 'error' } },
      { delay: 1000, robotId: 'ESTUN_ER3A_001',  type: 'trigger_alarm', params: { code: 'EST-3008', severity: 'warn' } },
      { delay: 1500, robotId: 'YASKAWA_GP7_001',  type: 'trigger_alarm', params: { code: 'ALM-201', severity: 'error' } },
    ],
  },

  // 故障恢复：告警 → 降温 → 清告警 → 复产（验证处置闭环）
  'fault-recovery': {
    label: '🔧 故障恢复',
    description: '触发告警 → 降温处置 → 清告警 → 恢复运行',
    steps: [
      { delay: 0,    robotId: 'FANUC_M20iD_001', type: 'trigger_alarm', params: { code: 'SRVO-023', severity: 'error' } },
      { delay: 2000, robotId: 'FANUC_M20iD_001', type: 'set_joint_temperature', params: { axis: 2, temperature: 45 } },
      { delay: 3000, robotId: 'FANUC_M20iD_001', type: 'clear_alarm' },
      { delay: 4000, robotId: 'FANUC_M20iD_001', type: 'resume' },
    ],
  },

  // 全部复位：6 台设备回到初始状态（路演收尾）
  'reset-all': {
    label: '🔄 全部复位',
    description: '所有设备告警清空、状态复位',
    steps: [], // 特殊处理：直接调 stateEngine.resetAll()
  },
}

export class ScenarioEngine extends EventEmitter {
  constructor(stateEngine, commandHandler) {
    super()
    this.state = stateEngine
    this.handler = commandHandler
    this.running = null // { name, abort: boolean }
  }

  list() {
    return Object.entries(SCENARIOS).map(([name, s]) => ({
      name, label: s.label, description: s.description, steps: s.steps.length,
    }))
  }

  isRunning() {
    return this.running ? this.running.name : null
  }

  async run(name, opts = {}) {
    const scenario = SCENARIOS[name]
    if (!scenario) throw new Error(`Scenario "${name}" not found`)
    if (this.running) throw new Error(`Scenario "${this.running.name}" 正在执行中`)

    this.running = { name, abort: false }
    const delayScale = opts.delayScale ?? 1 // 测试时传 0 跳过等待
    this.emitProgress(name, 0, scenario.steps.length, '启动')

    try {
      if (name === 'reset-all') {
        // 全部复位需要双写：本地 StateEngine + mock-ws-server 仿真器。
        // 只重置本地状态会被下一帧遥测把 error/alarm 同步回来，必须逐台下发 reset。
        const ids = [...this.state.devices.keys()]
        for (let i = 0; i < ids.length; i++) {
          if (this.running.abort) break
          try {
            await this.handler.execute({ robotId: ids[i], type: 'reset', params: {}, source: 'scenario' })
            this.emitProgress(name, i + 1, ids.length, `${ids[i]}: reset`)
          } catch (err) {
            this.emitProgress(name, i + 1, ids.length, `⚠ ${ids[i]} 复位失败: ${err.message}`)
          }
        }
        this.emitProgress(name, ids.length, ids.length, '全部设备已复位')
        return { started: true, completed: !this.running.abort, aborted: this.running.abort }
      }

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i]
        if (this.running.abort) break

        if (delayScale > 0) await sleep(step.delay * delayScale)
        if (this.running.abort) break

        try {
          await this.handler.execute({
            robotId: step.robotId,
            type: step.type,
            params: step.params || {},
            source: 'scenario',
          })
          this.emitProgress(name, i + 1, scenario.steps.length, `${step.robotId}: ${step.type}`)
        } catch (err) {
          // 单步失败不终止剧本（比如设备离线），记进进度
          this.emitProgress(name, i + 1, scenario.steps.length, `⚠ ${step.type} 失败: ${err.message}`)
        }
      }

      const aborted = this.running.abort
      this.emitProgress(name, scenario.steps.length, scenario.steps.length, aborted ? '已中止' : '完成')
      return { started: true, completed: !aborted, aborted }
    } finally {
      this.running = null
    }
  }

  stop() {
    if (!this.running) return { stopped: false }
    this.running.abort = true
    return { stopped: true, name: this.running.name }
  }

  emitProgress(name, phase, total, label) {
    this.emit('scenario', {
      name, phase, total, label,
      ts: Date.now(),
    })
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
