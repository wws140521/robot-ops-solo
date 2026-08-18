# Robot-Ops-Solo · 火锅店晚市传菜 SOP 开发文档

> 场景：火锅店晚市传菜（17:30 - 21:30）
> 品牌：擎朗 Peanut（送餐机器人，先用宇树 G1 mock 跑通）
> 目标：做完后你有一份**能拿去跟火锅店老板聊的成品 SOP**

---

## 一、场景建模：火锅店晚市长什么样

### 1.1 物理空间（简化版）

```
┌──────────────────────────────────────┐
│              厨房区域                 │
│  ┌────────┐                         │
│  │ 传菜口 │ ← A点 (0, 0)            │
│  └────────┘                         │
│       │                              │
│       │ 走廊                         │
│       │                              │
│  ┌────┴────┐                        │
│  │         │                        │
│  │ 大堂    │ ← B点 (5, 0) 3号桌    │
│  │         │ ← C点 (5, 3) 7号桌    │
│  │         │ ← D点 (0, 3) 5号桌    │
│  └─────────┘                        │
│                                     │
│  ┌────────┐                         │
│  │ 充电桩 │ ← E点 (8, 4)           │
│  └────────┘                         │
└──────────────────────────────────────┘
```

### 1.2 时间线

| 时间 | 动作 |
|------|------|
| 17:00 | 开机自检 → 回充电桩满电 |
| 17:30 | 到传菜口待命 |
| 17:50 | 开始第一轮传菜（晚市高峰开始）|
| 17:50 - 20:30 | 循环：传菜口取托盘 → 3号桌 → 7号桌 → 5号桌 → 回传菜口 |
| 每桌到达 | 播报"小心烫手～" + 停留 3 秒 |
| 电量 < 30% | 自动回充 15 分钟 → 继续 |
| 20:30 | 高峰结束，降频（每 5 分钟一轮）|
| 21:00 | 最后一轮 |
| 21:15 | 回充电桩 |
| 21:30 | 关机（发日报）|

### 1.3 异常分支

| 异常 | 处理 |
|------|------|
| 行人阻挡（距离 < 0.6m）| 停 2 秒 → 重新规划路径 |
| 托盘空（重量传感器 = 0）| 回传菜口，播报"请放餐" |
| 电量 < 15% | 立即回充，跳过当前循环 |
| 卡死 > 10 秒 | 发告警到企微 + 播报"需要帮助" |

---

## 二、SOP 数据结构设计

### 2.1 完整 SOP Graph JSON

这是你要生成的**最终产物**，存进 Supabase `sop_templates` 表或本地 JSON 文件。

```json
{
  "id": "hotpot-dinner-v1",
  "name": "火锅店晚市传菜 · 标准版",
  "industry": "hotpot",
  "brand": "keenon",
  "model": "peanut-v4",
  "version": 1,
  "createdAt": 1741584000000,
  "nodes": [
    {
      "id": "boot",
      "type": "boot",
      "position": { "x": 100, "y": 50 },
      "data": {
        "label": "开机自检",
        "action": "self_check",
        "timeout": 30,
        "onFail": "alert"
      }
    },
    {
      "id": "charge_full",
      "type": "move",
      "position": { "x": 100, "y": 150 },
      "data": {
        "label": "回充电桩",
        "target": "E",
        "speed": 0.6,
        "waitForCharge": true,
        "chargeTarget": 95
      }
    },
    {
      "id": "goto_kitchen",
      "type": "move",
      "position": { "x": 100, "y": 250 },
      "data": {
        "label": "到传菜口待命",
        "target": "A",
        "speed": 0.8,
        "arrivalAction": "wait_for_load"
      }
    },
    {
      "id": "wait_signal",
      "type": "wait",
      "position": { "x": 100, "y": 350 },
      "data": {
        "label": "等待出餐信号",
        "trigger": "kitchen_signal",
        "timeout": 600,
        "onTimeout": "return_home"
      }
    },
    {
      "id": "loop_start",
      "type": "loop",
      "position": { "x": 350, "y": 350 },
      "data": {
        "label": "传菜循环",
        "mode": "time_range",
        "startTime": "17:50",
        "endTime": "20:30",
        "maxRounds": 40,
        "onComplete": "slow_mode"
      }
    },
    {
      "id": "pick_tray",
      "type": "pickup",
      "position": { "x": 350, "y": 250 },
      "data": {
        "label": "取托盘",
        "checkWeight": true,
        "minWeight": 200,
        "onEmpty": "wait_reload"
      }
    },
    {
      "id": "goto_table3",
      "type": "move",
      "position": { "x": 600, "y": 150 },
      "data": {
        "label": "→ 3号桌",
        "target": "B",
        "speed": 0.7,
        "avoidPedestrian": true,
        "minDistance": 0.6
      }
    },
    {
      "id": "speak_table3",
      "type": "speak",
      "position": { "x": 600, "y": 50 },
      "data": {
        "label": "播报·3号桌",
        "text": "您好，小心烫手～",
        "volume": 0.8,
        "waitAfter": 3
      }
    },
    {
      "id": "goto_table7",
      "type": "move",
      "position": { "x": 600, "y": 450 },
      "data": {
        "label": "→ 7号桌",
        "target": "C",
        "speed": 0.7,
        "avoidPedestrian": true,
        "minDistance": 0.6
      }
    },
    {
      "id": "speak_table7",
      "type": "speak",
      "position": { "x": 600, "y": 550 },
      "data": {
        "label": "播报·7号桌",
        "text": "您好，小心烫手～",
        "volume": 0.8,
        "waitAfter": 3
      }
    },
    {
      "id": "goto_table5",
      "type": "move",
      "position": { "x": 350, "y": 550 },
      "data": {
        "label": "→ 5号桌",
        "target": "D",
        "speed": 0.7,
        "avoidPedestrian": true,
        "minDistance": 0.6
      }
    },
    {
      "id": "speak_table5",
      "type": "speak",
      "position": { "x": 350, "y": 650 },
      "data": {
        "label": "播报·5号桌",
        "text": "您好，小心烫手～",
        "volume": 0.8,
        "waitAfter": 3
      }
    },
    {
      "id": "return_kitchen",
      "type": "move",
      "position": { "x": 100, "y": 650 },
      "data": {
        "label": "回传菜口",
        "target": "A",
        "speed": 0.8
      }
    },
    {
      "id": "check_battery",
      "type": "condition",
      "position": { "x": 100, "y": 750 },
      "data": {
        "label": "电量检查",
        "field": "batteryPct",
        "operator": "<",
        "value": 30,
        "onTrue": "goto_charge",
        "onFalse": "loop_start"
      }
    },
    {
      "id": "goto_charge",
      "type": "move",
      "position": { "x": 100, "y": 850 },
      "data": {
        "label": "低电回充",
        "target": "E",
        "speed": 0.9,
        "waitForCharge": true,
        "chargeMinutes": 15
      }
    },
    {
      "id": "slow_mode",
      "type": "loop",
      "position": { "x": 350, "y": 850 },
      "data": {
        "label": "降频模式",
        "mode": "time_range",
        "startTime": "20:30",
        "endTime": "21:00",
        "interval": 300,
        "onComplete": "shutdown"
      }
    },
    {
      "id": "shutdown",
      "type": "shutdown",
      "position": { "x": 350, "y": 950 },
      "data": {
        "label": "关机+发日报",
        "sendReport": true,
        "reportChannels": ["wechat", "email"]
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "boot", "target": "charge_full" },
    { "id": "e2", "source": "charge_full", "target": "goto_kitchen" },
    { "id": "e3", "source": "goto_kitchen", "target": "wait_signal" },
    { "id": "e4", "source": "wait_signal", "target": "loop_start" },
    { "id": "e5", "source": "loop_start", "target": "pick_tray" },
    { "id": "e6", "source": "pick_tray", "target": "goto_table3" },
    { "id": "e7", "source": "goto_table3", "target": "speak_table3" },
    { "id": "e8", "source": "speak_table3", "target": "goto_table7" },
    { "id": "e9", "source": "goto_table7", "target": "speak_table7" },
    { "id": "e10", "source": "speak_table7", "target": "goto_table5" },
    { "id": "e11", "source": "goto_table5", "target": "speak_table5" },
    { "id": "e12", "source": "speak_table5", "target": "return_kitchen" },
    { "id": "e13", "source": "return_kitchen", "target": "check_battery" },
    { "id": "e14", "source": "check_battery", "target": "loop_start", "label": "≥30%" },
    { "id": "e15", "source": "check_battery", "target": "goto_charge", "label": "<30%" },
    { "id": "e16", "source": "goto_charge", "target": "loop_start" },
    { "id": "e17", "source": "loop_start", "target": "slow_mode", "label": "20:30到" },
    { "id": "e18", "source": "slow_mode", "target": "shutdown", "label": "21:00到" }
  ],
  "waypoints": {
    "A": { "x": 0, "y": 0, "name": "传菜口" },
    "B": { "x": 5, "y": 0, "name": "3号桌" },
    "C": { "x": 5, "y": 3, "name": "7号桌" },
    "D": { "x": 0, "y": 3, "name": "5号桌" },
    "E": { "x": 8, "y": 4, "name": "充电桩" }
  },
  "alerts": {
    "obstacle": {
      "threshold": 0.6,
      "action": "stop_2s_replan"
    },
    "trayEmpty": {
      "sensorField": "trayWeight",
      "minValue": 200,
      "action": "return_kitchen_speak"
    },
    "batteryCritical": {
      "threshold": 15,
      "action": "emergency_charge"
    },
    "stuckTimeout": {
      "seconds": 10,
      "action": "alert_wechat_speak_help"
    }
  }
}
```

### 2.2 支持的节点类型一览

| type | 说明 | 必填 data 字段 |
|------|------|----------------|
| `boot` | 开机自检 | action, timeout, onFail |
| `move` | 移动到航点 | target, speed |
| `wait` | 等待信号/超时 | trigger, timeout |
| `pickup` | 取托盘（重量检测）| checkWeight, minWeight |
| `speak` | 播报话术 | text, volume, waitAfter |
| `loop` | 循环（时间/次数）| mode, startTime, endTime |
| `condition` | 条件分支 | field, operator, value |
| `shutdown` | 关机+日报 | sendReport, reportChannels |

---

## 三、SOP 执行引擎（核心代码）

### 3.1 执行引擎 `sop-executor.ts`

这是 SOP 的"大脑"——把上面的 JSON 变成实际行为。放在 `packages/sop-editor/src/engine/` 下。

```ts
// packages/sop-editor/src/engine/sop-executor.ts
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

  constructor(private graph: SopGraph, private ctx: ExecutorContext) {
    // 建索引
    graph.nodes.forEach(n => this.nodeMap.set(n.id, n))
    graph.edges.forEach(e => {
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

      console.log(`[SOP] ▶ ${node.data.label} (${node.type})`)
      await this.executeNode(node)

      // 找下一个节点
      const next = this.findNextNode(node)
      if (!next) {
        console.log(`[SOP] 流程结束`)
        break
      }
      this.currentNodeId = next
    }
  }

  stop() {
    this.running = false
    console.log(`[SOP] 已停止`)
  }

  private async executeNode(node: SopNode) {
    const { type, data } = node

    switch (type) {
      case 'boot':
        await this.ctx.wait(2) // 模拟自检
        break

      case 'move': {
        const waypoint = this.graph.waypoints[data.target]
        if (!waypoint) throw new Error(`航点不存在: ${data.target}`)
        await this.ctx.moveTo(data.target, data.speed ?? 0.7)
        if (data.waitForCharge) {
          const minutes = data.chargeMinutes ?? 15
          await this.ctx.charge(minutes)
        }
        break
      }

      case 'wait':
        await this.ctx.wait(Math.min(data.timeout ?? 60, 600))
        break

      case 'pickup': {
        const weight = this.ctx.checkWeight()
        if (data.checkWeight && weight < (data.minWeight ?? 200)) {
          console.log(`[SOP] 托盘为空 (${weight}g)，等待重新装载`)
          // 回到传菜口等
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
        // 时间范围循环由外部时钟驱动，这里只标记
        const now = this.ctx.now()
        const start = this.parseTime(data.startTime, now)
        const end = this.parseTime(data.endTime, now)
        if (now < start || now > end) {
          // 不在时间范围内，跳过循环
          this.currentNodeId = data.onComplete ?? null
          return
        }
        break
      }

      case 'condition': {
        const fieldValue = this.getFieldValue(data.field)
        const passed = this.evalCondition(fieldValue, data.operator, data.value)
        if (passed) {
          this.currentNodeId = data.onTrue
        } else {
          this.currentNodeId = data.onFalse
        }
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
    const defaultEdge = edges.find(e => !e.label)
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
      case '<': return val < target
      case '<=': return val <= target
      case '>': return val > target
      case '>=': return val >= target
      case '==': return val === target
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
```

### 3.2 模拟执行器 `sop-simulator.ts`

让 SOP 在**没有真机**的情况下也能跑起来，用于演示和测试。

```ts
// packages/sop-editor/src/engine/sop-simulator.ts
import { SopExecutor, ExecutorContext } from './sop-executor'
import type { SopGraph } from '../schema/sop-schema'

// 事件回调类型
export interface SimEvents {
  onNodeEnter?: (nodeId: string, label: string) => void
  onSpeak?: (text: string) => void
  onMove?: (from: string, to: string) => void
  onAlert?: (code: string, msg: string) => void
  onComplete?: () => void
  onLog?: (msg: string) => void
}

export function createSimulator(graph: SopGraph, events: SimEvents) {
  // 模拟状态
  let batteryPct = 85
  let trayWeight = 500
  let pos = { x: 0, y: 0 }

  const ctx: ExecutorContext = {
    robotId: 'peanut-001',
    batteryPct: 85,
    currentPosition: pos,
    trayWeight: 500,
    now: () => new Date(),

    moveTo: async (target, speed) => {
      events.onMove?.(`(${pos.x},${pos.y})`, target)
      events.onLog?.(`  移动 → ${target} (速度 ${speed})`)
      // 模拟移动耗时
      const delay = Math.max(500, 2000 / speed)
      await new Promise(r => setTimeout(r, delay))
      // 更新位置
      const wp = graph.waypoints[target]
      if (wp) { pos.x = wp.x; pos.y = wp.y }
      batteryPct -= 0.5 // 每移动一次掉 0.5%
      ctx.batteryPct = batteryPct
    },

    speak: async (text, volume) => {
      events.onSpeak?.(text)
      events.onLog?.(`  🔊 播报: "${text}" (音量 ${volume})`)
      await new Promise(r => setTimeout(r, 500))
    },

    wait: async (seconds) => {
      events.onLog?.(`  ⏳ 等待 ${seconds}s`)
      await new Promise(r => setTimeout(r, Math.min(seconds * 100, 3000)))
    },

    checkWeight: () => {
      // 模拟：第一次有重量，送完变空
      const w = trayWeight
      trayWeight = 0 // 下次检查为空
      return w
    },

    sendAlert: (code, msg) => {
      events.onAlert?.(code, msg)
      events.onLog?.(`  ⚠️ 告警 [${code}]: ${msg}`)
    },

    charge: async (minutes) => {
      events.onLog?.(`  🔌 充电 ${minutes} 分钟`)
      await new Promise(r => setTimeout(r, 2000)) // 模拟快进
      batteryPct = Math.min(95, batteryPct + 30)
      ctx.batteryPct = batteryPct
      events.onLog?.(`  ✅ 电量恢复至 ${batteryPct}%`)
    },
  }

  const executor = new SopExecutor(graph, ctx)

  // 包装 start，加日志
  return {
    async start() {
      events.onLog?.('═══ SOP 模拟开始 ═══')
      events.onLog?.(`场景: ${graph.name}`)
      events.onLog?.(`品牌: ${graph.brand} / ${graph.model}`)
      events.onLog?.('─────────────────')
      await executor.start('boot')
      events.onLog?.('═══ SOP 模拟结束 ═══')
      events.onComplete?.()
    },
    stop: () => executor.stop(),
  }
}
```

### 3.3 在 React 里用：SOP 模拟运行面板

```tsx
// apps/web-console/src/routes/SopSimPage.tsx
import { useState } from 'react'
import { createSimulator } from 'sop-editor/engine/sop-simulator'
import hotpotGraph from '../../../templates/hotpot-dinner-v1.json'

export function SopSimPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [speaking, setSpeaking] = useState('')
  const [running, setRunning] = useState(false)

  const addLog = (msg: string) =>
    setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`])

  const start = async () => {
    setRunning(true)
    setLogs([])
    const sim = createSimulator(hotpotGraph, {
      onLog: addLog,
      onSpeak: (text) => { addLog(`🔊 ${text}`); setSpeaking(text) },
      onMove: (from, to) => addLog(`→ 从 ${from} 到 ${to}`),
      onAlert: (code, msg) => addLog(`⚠️ [${code}] ${msg}`),
      onComplete: () => { addLog('✅ 执行完毕'); setRunning(false) },
    })
    await sim.start()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 24 }}>
      {/* 左：控制面板 */}
      <div>
        <h2>🍲 火锅店晚市传菜 SOP</h2>
        <p>场景：{hotpotGraph.name}</p>
        <p>品牌：{hotpotGraph.brand} / {hotpotGraph.model}</p>
        <button
          onClick={start}
          disabled={running}
          style={{
            padding: '12px 32px', fontSize: 16,
            background: running ? '#ccc' : '#dc2626',
            color: 'white', border: 'none', borderRadius: 8,
            cursor: running ? 'not-allowed' : 'pointer'
          }}
        >
          {running ? '执行中...' : '▶ 开始模拟执行'}
        </button>

        {/* 播报气泡 */}
        {speaking && (
          <div style={{
            marginTop: 24, padding: 16, background: '#fef3c7',
            borderRadius: 12, border: '2px solid #f59e0b',
            fontSize: 18, animation: 'pulse 1s infinite'
          }}>
            🔊 {speaking}
          </div>
        )}
      </div>

      {/* 右：执行日志 */}
      <div>
        <h3>📋 执行日志</h3>
        <div style={{
          height: 500, overflowY: 'auto', background: '#1e1e1e',
          color: '#d4d4d4', padding: 16, borderRadius: 8,
          fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6
        }}>
          {logs.map((log, i) => (
            <div key={i} style={{
              color: log.includes('⚠️') ? '#f87171' :
                     log.includes('🔊') ? '#fbbf24' :
                     log.includes('✅') ? '#4ade80' :
                     '#d4d4d4'
            }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## 四、SOP 模板存储

### 4.1 本地存储（不用 Supabase 也能跑）

```ts
// apps/web-console/src/lib/sop-storage.ts
import type { SopGraph } from 'sop-editor'

const KEY = 'sop_templates'

export function saveSop(graph: SopGraph) {
  const all = getAllSops()
  all[graph.id] = graph
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function getSop(id: string): SopGraph | null {
  return getAllSops()[id] ?? null
}

export function getAllSops(): Record<string, SopGraph> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch { return {} }
}

export function deleteSop(id: string) {
  const all = getAllSops()
  delete all[id]
  localStorage.setItem(KEY, JSON.stringify(all))
}
```

### 4.2 Supabase 表（生产环境）

```sql
-- sop_templates 表（在 DEV-GUIDE.md 基础上补充字段）
alter table sop_templates add column if not exists
  graph jsonb not null;

alter table sop_templates add column if not exists
  waypoints jsonb default '{}';

alter table sop_templates add column if not exists
  alerts jsonb default '{}';

alter table sop_templates add column if not exists
  version int default 1;

-- 索引：按行业+品牌快速查模板
create index idx_sop_industry on sop_templates(industry);
create index idx_sop_brand on sop_templates(brand, model);
```

---

## 五、SOP 画布节点扩展

### 5.1 新增节点类型注册

在 `packages/sop-editor/src/nodes/` 下加 4 个新节点组件：

#### BootNode.tsx
```tsx
import { Handle, Position } from '@xyflow/react'
export function BootNode({ data }: { data: any }) {
  return (
    <div style={{ background: '#10b981', color: 'white', padding: '8px 16px', borderRadius: 8 }}>
      🔧 {data.label}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
```

#### PickupNode.tsx
```tsx
import { Handle, Position } from '@xyflow/react'
export function PickupNode({ data }: { data: any }) {
  return (
    <div style={{ background: '#8b5cf6', color: 'white', padding: '8px 16px', borderRadius: 8 }}>
      📦 {data.label}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
```

#### ConditionNode.tsx
```tsx
import { Handle, Position } from '@xyflow/react'
export function ConditionNode({ data }: { data: any }) {
  return (
    <div style={{ background: '#f59e0b', color: 'black', padding: '8px 16px', borderRadius: 8, minWidth: 120 }}>
      ❓ {data.label}
      <div style={{ fontSize: 11, marginTop: 4 }}>{data.field} {data.operator} {data.value}</div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} />
    </div>
  )
}
```

#### ShutdownNode.tsx
```tsx
import { Handle, Position } from '@xyflow/react'
export function ShutdownNode({ data }: { data: any }) {
  return (
    <div style={{ background: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: 8 }}>
      🔴 {data.label}
      <Handle type="target" position={Position.Top} />
    </div>
  )
}
```

### 5.2 注册到 SopEditor

```tsx
// packages/sop-editor/src/SopEditor.tsx
import { BootNode } from './nodes/BootNode'
import { PickupNode } from './nodes/PickupNode'
import { ConditionNode } from './nodes/ConditionNode'
import { ShutdownNode } from './nodes/ShutdownNode'

const nodeTypes = {
  move: MoveNode,
  speak: SpeakNode,
  wait: WaitNode,
  loop: LoopNode,
  boot: BootNode,
  pickup: PickupNode,
  condition: ConditionNode,
  shutdown: ShutdownNode,
}
```

---

## 六、文件清单（这次要新建/修改的）

### 新建文件

```
packages/sop-editor/src/
├── engine/
│   ├── sop-executor.ts        ← SOP 执行引擎（核心）
│   └── sop-simulator.ts       ← 无真机模拟器
├── nodes/
│   ├── BootNode.tsx           ← 新增
│   ├── PickupNode.tsx         ← 新增
│   ├── ConditionNode.tsx       ← 新增
│   └── ShutdownNode.tsx        ← 新增
└── schema/
    └── hotpot-dinner-v1.json  ← SOP 模板数据

apps/web-console/src/
├── routes/
│   └── SopSimPage.tsx         ← SOP 模拟运行页面
└── lib/
    └── sop-storage.ts         ← 本地存储封装

templates/
└── hotpot-dinner-v1.json      ← 模板副本（方便导入）
```

### 修改文件

```
packages/sop-editor/src/SopEditor.tsx    ← 注册 4 个新节点类型
apps/web-console/src/App.tsx            ← 加路由 /sop-sim
apps/web-console/src/lib/wsHub.ts       ← 加 sendCommand 方法（SOP→机器人反向控制）
```

---

## 七、操作步骤（按顺序）

### Step 1：建 engine 目录（30 分钟）

把第三节的 `sop-executor.ts` 和 `sop-simulator.ts` 复制到 `packages/sop-editor/src/engine/`。

### Step 2：加 4 个新节点组件（30 分钟）

把第五节 4 个 Node.tsx 复制到 `packages/sop-editor/src/nodes/`，注册到 `SopEditor.tsx`。

### Step 3：放 SOP 模板 JSON（5 分钟）

把第二节的完整 JSON 存成 `packages/sop-editor/src/schema/hotpot-dinner-v1.json`。

### Step 4：建模拟运行页面（30 分钟）

把第三节的 `SopSimPage.tsx` 放到 `apps/web-console/src/routes/`，在 `App.tsx` 加路由：

```tsx
// App.tsx
import { SopSimPage } from './routes/SopSimPage'
// ...
<Route path="/sop-sim" element={<SopSimPage />} />
```

### Step 5：加本地存储（10 分钟）

把第四节的 `sop-storage.ts` 放到 `apps/web-console/src/lib/`。

### Step 6：跑起来验证

```bash
node mock-ws-server.js        # 终端 1
pnpm --filter web-console dev  # 终端 2
```

打开浏览器 → 点导航栏 "SOP 模拟" → 点 "▶ 开始模拟执行"

**你应该看到：**
- 日志面板逐行打印执行过程
- 每隔几秒弹一次"🔊 小心烫手～"气泡
- 电量从 85% 逐步下降
- 到电量 < 30% 时自动回充
- 最终打印 "✅ 执行完毕"

---

## 八、验证清单

| # | 验证项 | 预期结果 |
|---|--------|----------|
| 1 | 点"开始模拟执行" | 日志从"═══ SOP 模拟开始 ═══"开始 |
| 2 | 开机自检 | 打印"🔧 开机自检"等待 2 秒 |
| 3 | 回充电桩 | 打印"🔌 充电"电量恢复至 95% |
| 4 | 到 3 号桌 | 打印"→ 从 (0,0) 到 B" + "🔊 小心烫手～" |
| 5 | 到 7 号桌 | 同上，目标 C |
| 6 | 到 5 号桌 | 同上，目标 D |
| 7 | 回传菜口 | 打印"→ 从 D 到 A" |
| 8 | 电量检查 < 30% | 走"低电回充"分支，打印"✅ 电量恢复" |
| 9 | 循环结束 | 走"降频模式"→"关机+发日报" |
| 10 | 最终 | 打印"═══ SOP 模拟结束 ═══" |

---

## 九、SOP 模板市场（未来扩展）

做完火锅店这一个，你的目录会长这样：

```
templates/
├── hotpot-dinner-v1.json       ✅ 已完成
├── hotpot-lunch-v1.json         ← 下一个（午市，桌数少/时间短）
├── pharmacy-pickup-v1.json      ← 药店取药交互
├── mall-patrol-v1.json          ← 商场巡逻+导购播报
├── factory-inspect-v1.json      ← 工厂巡检
└── restaurant-busboy-v1.json    ← 收碗筷机器人
```

每个模板的复用方式：

```ts
// 商户 A 是火锅店 → 选 hotpot-dinner-v1 → 改 3 个参数（桌号坐标、播报话术、高峰时段）
// 商户 B 是奶茶店 → 选 mall-patrol-v1 → 改 2 个参数（巡逻路线、促销话术）
// 交付时间从 3 天 → 30 分钟
```

---

## 十、接下来做什么

| 优先级 | 任务 | 耗时 |
|--------|------|------|
| 🔴 高 | 跑通 SopSimPage，确认 10 条验证全过 | 今天 |
| 🔴 高 | 录一段模拟运行的屏幕录像（给老板看）| 今天 |
| 🟡 中 | 加第二个 SOP 模板（午市/奶茶店 二选一）| 2 天 |
| 🟡 中 | 画布支持"导入 JSON"按钮（拖入即可加载）| 1 天 |
| 🟢 低 | 加企微 webhook 推送（告警实时到手机）| 2 天 |
| 🟢 低 | 接真擎朗 Peanut 协议（adapter-keenon 补全）| 3-5 天 |

---

## 附录 A：完整文件树（做完后）

```
robot-ops-solo/
├── templates/
│   └── hotpot-dinner-v1.json     ← SOP 模板（可独立分发）
│
├── packages/sop-editor/src/
│   ├── engine/
│   │   ├── sop-executor.ts       ← 执行引擎
│   │   └── sop-simulator.ts      ← 模拟器
│   ├── nodes/
│   │   ├── MoveNode.tsx
│   │   ├── SpeakNode.tsx
│   │   ├── WaitNode.tsx
│   │   ├── LoopNode.tsx
│   │   ├── BootNode.tsx          ← 新增
│   │   ├── PickupNode.tsx        ← 新增
│   │   ├── ConditionNode.tsx      ← 新增
│   │   └── ShutdownNode.tsx       ← 新增
│   ├── schema/
│   │   ├── sop-schema.ts
│   │   └── hotpot-dinner-v1.json ← SOP 数据
│   ├── hooks/useSopStore.ts
│   └── SopEditor.tsx             ← 注册新节点
│
└── apps/web-console/src/
    ├── routes/
    │   ├── SopPage.tsx
    │   └── SopSimPage.tsx        ← 模拟运行页
    ├── lib/
    │   ├── wsHub.ts              ← 加 sendCommand
    │   └── sop-storage.ts        ← 本地存储
    └── App.tsx                   ← 加 /sop-sim 路由
```

---

> 文档版本：v1.0 | 场景：火锅店晚市传菜 | 适用栈：React 18 + Vite 5 + pnpm workspace
> 更新日期：2026-03
