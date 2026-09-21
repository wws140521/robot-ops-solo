// mock-control/server/command-handler.js
// 指令处理器：zod 校验 → StateEngine 应用 → 桥接下发（MQTT / WS 直连）
// 告警类指令会额外广播 alert 事件，SSE 推给操作页面日志面板。

import { z } from 'zod'

const CommandSchema = z.object({
  robotId: z.string().min(1),
  type: z.enum([
    'start', 'stop', 'pause', 'resume', 'reset',
    'move_to', 'set_velocity', 'return_to_charge', 'set_mode',
    'set_joint_angle', 'set_joint_temperature', 'trigger_alarm', 'clear_alarm', 'set_load',
    'open_dock_door', 'close_dock_door', 'dispatch_uav', 'recall_uav',
    'set_battery', 'set_health_score', 'inject_fault', 'simulate_offline', 'custom_telemetry',
  ]),
  params: z.record(z.unknown()).optional().default({}),
  source: z.enum(['control-panel', 'scenario', 'api']).optional(),
  ts: z.number().optional(),
})

// 每种指令的 params 细粒度校验（缺参/类型错给 400，别等到状态引擎才炸）
const ParamSchemas = {
  set_battery: z.object({ level: z.number() }),
  set_health_score: z.object({ score: z.number() }),
  set_joint_temperature: z.object({ axis: z.number().int().min(1).max(6), temperature: z.number() }),
  set_joint_angle: z.object({ axis: z.number().int().min(1).max(6), angle: z.number() }),
  set_load: z.object({ axis: z.number().int().min(1).max(6), load: z.number() }),
  trigger_alarm: z.object({ code: z.string().min(1), severity: z.enum(['info', 'warn', 'error']).optional() }),
  clear_alarm: z.object({ code: z.string().optional() }).optional(),
  set_mode: z.object({ mode: z.enum(['auto', 'manual']) }),
  move_to: z.object({ x: z.number(), y: z.number(), speed: z.number().optional() }),
  set_velocity: z.object({ linear: z.number(), angular: z.number().optional() }),
  simulate_offline: z.object({ duration_ms: z.number().optional() }).optional(),
  inject_fault: z.object({ type: z.string().optional() }).optional(),
  custom_telemetry: z.object({ patch: z.record(z.unknown()).optional() }).optional(),
}

export class CommandHandler {
  constructor(stateEngine, bridge) {
    this.state = stateEngine
    this.bridge = bridge // ControlBridge：sendCommand(command) / publishAlert(alert)
  }

  async execute(rawCommand) {
    // [1] 基础校验
    const command = CommandSchema.parse(rawCommand)
    command.ts = Date.now()

    // [2] params 细粒度校验
    const paramSchema = ParamSchemas[command.type]
    if (paramSchema) {
      command.params = paramSchema.parse(command.params ?? {})
    }

    // [3] 设备存在性校验（比 Zod 给的报错信息友好）
    if (!this.state.get(command.robotId)) {
      const err = new Error(`Device "${command.robotId}" not found`)
      err.status = 404
      throw err
    }

    // [4] 状态变更（本地状态树先行，UI 乐观更新）
    const newState = this.state.apply(command)

    // [5] 下发到 mock-ws-server（MQTT broker 或 WS 直连，二选一自动降级）
    let delivery = null
    if (this.bridge) {
      delivery = await this.bridge.sendCommand(command)

      // 告警类指令额外走 alerts/broadcast 广播
      if (command.type === 'trigger_alarm') {
        await this.bridge.publishAlert({
          robotId: command.robotId,
          code: command.params.code,
          severity: command.params.severity || 'warn',
          zh_desc: this.state.getAlarmDescription(command.params.code),
          ts: command.ts,
        })
      }
    }

    return { success: true, state: newState, delivery }
  }

  // 批量指令：逐条执行，单条失败不中断（结果数组里带 error）
  async executeBatch(rawCommands) {
    const results = []
    for (const raw of rawCommands) {
      try {
        const r = await this.execute(raw)
        results.push({ success: true, state: r.state })
      } catch (err) {
        results.push({ success: false, error: err.message })
      }
    }
    return { success: results.every((r) => r.success), results }
  }
}
