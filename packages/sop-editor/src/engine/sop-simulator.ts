// 2026-08-18 实现 SOP 模拟器，无真机也能跑，对应 SOP-HOTPOT 3.2
// 2026-08-19 增强：内置模拟时钟（18:00 起步）+ 加大掉电速率，验证清单 10 条全部可观测
import { SopExecutor, type ExecutorContext } from './sop-executor'
import type { SopGraph, Waypoint } from '../schema/sop-schema'

export interface SimEvents {
  onNodeEnter?: (nodeId: string, label: string) => void
  onSpeak?: (text: string) => void
  onMove?: (from: string, to: string) => void
  onAlert?: (code: string, msg: string) => void
  onComplete?: () => void
  onLog?: (msg: string) => void
  onState?: (state: { batteryPct: number; pos: { x: number; y: number }; simTime: Date }) => void
}

export function createSimulator(graph: SopGraph, events: SimEvents) {
  let batteryPct = 85
  let trayWeight = 500
  const pos = { x: 0, y: 0 }

  // 2026-08-18 模拟时钟从今天 18:00 起步，落在晚市高峰 17:50-20:30 内
  const simNow = new Date()
  simNow.setHours(18, 0, 0, 0)
  const advance = (minutes: number) => {
    simNow.setTime(simNow.getTime() + minutes * 60_000)
  }
  const emitState = () =>
    events.onState?.({ batteryPct, pos: { ...pos }, simTime: new Date(simNow) })

  const ctx: ExecutorContext = {
    robotId: 'peanut-001',
    batteryPct: 85,
    currentPosition: pos,
    trayWeight: 500,
    now: () => new Date(simNow),

    moveTo: async (target, speed) => {
      events.onMove?.(`(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`, target)
      events.onLog?.(`  移动 → ${target} (速度 ${speed})`)
      console.log('[sop-sim] moveTo:', { from: { x: pos.x, y: pos.y }, target, speed })
      await new Promise((r) => setTimeout(r, 600))
      const wp = graph.waypoints?.[target] as Waypoint | undefined
      if (wp) {
        pos.x = wp.x
        pos.y = wp.y
      }
      // 2026-08-18 演示用掉电速率调高到 15%/段，便于触发 <30% 回充分支
      batteryPct = Math.max(0, batteryPct - 15)
      ctx.batteryPct = batteryPct
      advance(25) // 模拟 25 分钟行程
      console.log('[sop-sim] moveTo 完成:', { target, batteryAfter: batteryPct, simTime: new Date(simNow).toLocaleTimeString() })
      emitState()
    },

    speak: async (text, volume) => {
      events.onSpeak?.(text)
      events.onLog?.(`  🔊 播报: "${text}" (音量 ${volume})`)
      await new Promise((r) => setTimeout(r, 400))
      advance(1)
      emitState()
    },

    wait: async (seconds) => {
      const realDelay = Math.min(seconds * 100, 3000)
      events.onLog?.(`  ⏳ 等待 ${seconds}s（演示快进 ${(realDelay / 1000).toFixed(1)}s）`)
      await new Promise((r) => setTimeout(r, realDelay))
      advance(Math.min(seconds / 60, 10))
      emitState()
    },

    checkWeight: () => {
      // 2026-08-18 模拟取托盘重量，第一次有重量送完变空
      const w = trayWeight
      trayWeight = 0
      ctx.trayWeight = 0
      return w
    },

    sendAlert: (code, msg) => {
      events.onAlert?.(code, msg)
      events.onLog?.(`  ⚠️ 告警 [${code}]: ${msg}`)
    },

    charge: async (minutes) => {
      events.onLog?.(`  🔌 充电 ${minutes} 分钟`)
      console.log('[sop-sim] charge:', { minutes, batteryBefore: batteryPct })
      await new Promise((r) => setTimeout(r, 1500))
      batteryPct = Math.min(95, batteryPct + 30)
      ctx.batteryPct = batteryPct
      events.onLog?.(`  ✅ 电量恢复至 ${batteryPct}%`)
      console.log('[sop-sim] charge 完成:', { batteryAfter: batteryPct })
      advance(minutes)
      emitState()
    },
  }

  const executor = new SopExecutor(graph, ctx, (node) => {
    const label = (node.data as { label?: string }).label ?? node.id
    events.onNodeEnter?.(node.id, label)
    events.onLog?.(`▶ ${label} (${node.type})`)
  })

  return {
    async start() {
      events.onLog?.('═══ SOP 模拟开始 ═══')
      events.onLog?.(`场景: ${graph.name}`)
      events.onLog?.(`品牌: ${graph.brand} / ${graph.model}`)
      events.onLog?.('─────────────────')
      emitState()
      await executor.start('boot')
      events.onLog?.('═══ SOP 模拟结束 ═══')
      events.onComplete?.()
    },
    stop: () => executor.stop(),
  }
}
