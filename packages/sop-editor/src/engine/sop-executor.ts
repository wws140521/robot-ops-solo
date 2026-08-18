// SOP 执行引擎 —— 把 SOP Graph JSON 变成实际行为
// 对应 SOP-HOTPOT.md 第三节 3.1
import type { SopGraph, SopNode, SopEdge } from '../schema/sop-schema'

export interface ExecutorContext {
  robotId: string
  batteryPct: number
  currentPosition: { x: number; y: number }
  trayWeight: number
  now: () => Date
  // 外部注入的能力（不耦合具体实现）
  moveTo: (target: string, speed: number) => Promise<void>
  speak: (text: string, volume: number) => Promise<void>
  wait: (seconds: number) => Promise<void>
  checkWeight: () => number
  sendAlert: (code: string, msg: string) => void
  charge: (minutes: number) => Promise<void>
}

export class SopExecutor {
  private nodeMap: Map<string, SopNode> = new Map()
  private edgeMap: Map<string, SopEdge[]> = new Map()
  private running = false
  private currentNodeId: string | null = null

  constructor(
    private graph: SopGraph,
    private ctx: ExecutorContext,
    // 节点进入回调：用于把 "[SOP] ▶ 节点名 (type)" 转发到 UI 日志面板
    private onNodeEnter?: (node: SopNode) => void
  ) {
    graph.nodes.forEach((n) => this.nodeMap.set(n.id, n))
    graph.edges.forEach((e) => {
      const list = this.edgeMap.get(e.source) ?? []
      list.push(e)
      this.edgeMap.set(e.source, list)
    })
  }

  async start(entryNodeId = 'boot') {
    this.running = true
    this.currentNodeId = entryNodeId
    console.log(`[SOP] 开始执行: ${this.graph.name}`)

    while (this.running && this.currentNodeId) {
      const node = this.nodeMap.get(this.currentNodeId)
      if (!node) {
        console.error(`[SOP] 节点不存在: ${this.currentNodeId}`)
        break
      }

      const label = (node.data as { label?: string }).label ?? node.id
      console.log(`[SOP] ▶ ${label} (${node.type})`)
      // 转发到 UI 日志面板（验证清单第 2/3/4… 条要求看到节点名）
      this.onNodeEnter?.(node)
      await this.executeNode(node)

      if (!this.running) break // 节点可能已 stop 或 shutdown

      // 找下一个节点（条件/循环节点可能已在 executeNode 内直接设定 currentNodeId）
      if (this.currentNodeId === node.id) {
        const next = this.findNextNode(node)
        this.currentNodeId = next
        if (!next) {
          console.log(`[SOP] 流程结束`)
          break
        }
      }
    }
  }

  stop() {
    this.running = false
    console.log(`[SOP] 已停止`)
  }

  private async executeNode(node: SopNode) {
    const { type } = node
    // 节点 data 是联合类型，引擎按 JSON 语义宽松访问
    const data = node.data as any

    switch (type) {
      case 'boot':
        await this.ctx.wait(2) // 模拟自检
        break

      case 'move': {
        const target = data.target
        if (target) {
          const waypoint = this.graph.waypoints?.[target]
          if (!waypoint) throw new Error(`航点不存在: ${target}`)
          await this.ctx.moveTo(target, data.speed ?? 0.7)
        }
        if (data.waitForCharge) {
          const minutes = data.chargeMinutes ?? 15
          await this.ctx.charge(minutes)
        }
        break
      }

      case 'wait':
        await this.ctx.wait(Math.min(data.timeout ?? data.seconds ?? 60, 600))
        break

      case 'pickup': {
        const weight = this.ctx.checkWeight()
        if (data.checkWeight && weight < (data.minWeight ?? 200)) {
          console.log(`[SOP] 托盘为空 (${weight}g)，等待重新装载`)
          this.currentNodeId = 'wait_signal'
          return
        }
        break
      }

      case 'speak':
        await this.ctx.speak(data.text, data.volume ?? 0.8)
        if (data.waitAfter) await this.ctx.wait(data.waitAfter)
        break

      case 'loop': {
        // 时间范围循环：不在范围内则跳到 onComplete
        if (data.startTime && data.endTime) {
          const now = this.ctx.now()
          const start = this.parseTime(data.startTime, now)
          const end = this.parseTime(data.endTime, now)
          if (now < start || now > end) {
            this.currentNodeId = data.onComplete ?? null
            return
          }
        }
        break
      }

      case 'condition': {
        const fieldValue = this.getFieldValue(data.field)
        const passed = this.evalCondition(fieldValue, data.operator, data.value)
        this.currentNodeId = passed
          ? (data.onTrue ?? data.trueNodeId ?? null)
          : (data.onFalse ?? data.falseNodeId ?? null)
        return // condition 自己决定下一个节点
      }

      case 'shutdown':
        console.log(`[SOP] 📊 发送日报...`)
        this.ctx.sendAlert('SHUTDOWN', `SOP ${this.graph.name} 执行完毕`)
        this.running = false
        return
    }
  }

  private findNextNode(node: SopNode): string | null {
    const edges = this.edgeMap.get(node.id) ?? []
    if (edges.length === 0) return null
    // 优先选无 label 的（默认边），其次按条件选
    const defaultEdge = edges.find((e) => !e.label)
    return (defaultEdge ?? edges[0]).target
  }

  private getFieldValue(field: string): number {
    switch (field) {
      case 'batteryPct': return this.ctx.batteryPct
      case 'trayWeight': return this.ctx.trayWeight
      default: return 0
    }
  }

  private evalCondition(val: number, op: string, target: number): boolean {
    switch (op) {
      case '<': case 'lt': return val < target
      case '<=': return val <= target
      case '>': case 'gt': return val > target
      case '>=': return val >= target
      case '==': case 'eq': return val === target
      default: return false
    }
  }

  private parseTime(timeStr: string, base: Date): Date {
    const [h, m] = timeStr.split(':').map(Number)
    const d = new Date(base)
    d.setHours(h, m, 0, 0)
    return d
  }
}
