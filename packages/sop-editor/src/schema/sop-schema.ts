// SOP 图结构 —— 存进 Supabase sop_templates 表的 jsonb 字段
// 兼容两种数据风格：DEV-GUIDE 简版（x/y/count）+ SOP-HOTPOT 文档完整版（target/waypoints/onTrue）

export type SopNodeType =
  | 'boot'
  | 'move'
  | 'wait'
  | 'pickup'
  | 'speak'
  | 'loop'
  | 'condition'
  | 'shutdown'
  | 'readAlarm'
  | 'predict'
  | 'maintenance'
  | 'log'

export interface BaseData {
  label?: string
}

export interface BootData extends BaseData {
  action?: string
  timeout?: number
  onFail?: string
}

export interface MoveData extends BaseData {
  // 简版（DEV-GUIDE）
  x?: number
  y?: number
  waypoints?: { x: number; y: number }[]
  // 完整版（SOP-HOTPOT）
  target?: string
  speed?: number
  waitForCharge?: boolean
  chargeTarget?: number
  chargeMinutes?: number
  arrivalAction?: string
  avoidPedestrian?: boolean
  minDistance?: number
}

export interface WaitData extends BaseData {
  seconds?: number
  trigger?: string
  timeout?: number
  onTimeout?: string
}

export interface PickupData extends BaseData {
  checkWeight?: boolean
  minWeight?: number
  onEmpty?: string
}

export interface SpeakData extends BaseData {
  text: string
  volume?: number
  lang?: 'zh' | 'en'
  waitAfter?: number
}

export interface LoopData extends BaseData {
  // 简版
  count?: number
  breakCondition?: string
  // 完整版
  mode?: string
  startTime?: string
  endTime?: string
  maxRounds?: number
  interval?: number
  onComplete?: string
}

export type ConditionOperator = '<' | '<=' | '>' | '>=' | '==' | 'eq' | 'gt' | 'lt'

export interface ConditionData extends BaseData {
  field: string
  operator: ConditionOperator
  value: number | string
  onTrue?: string
  onFalse?: string
  // 简版别名
  trueNodeId?: string
  falseNodeId?: string
}

export interface ShutdownData extends BaseData {
  sendReport?: boolean
  reportChannels?: string[]
}

// ─── 工业运维节点数据 ───────────────────────────
export interface ReadAlarmData extends BaseData {
  robotId?: string
  condition?: string
}

export interface PredictData extends BaseData {
  target?: string
  apiEndpoint?: string
  robotId?: string
}

export interface MaintenanceData extends BaseData {
  priority?: 'low' | 'medium' | 'high' | 'critical'
  notifyChannel?: 'wecom' | 'dingtalk' | 'feishu' | 'email'
  assignee?: string
}

export interface LogData extends BaseData {
  level?: 'info' | 'warn' | 'error'
  message?: string
}

export type SopNodeData =
  | BootData
  | MoveData
  | WaitData
  | PickupData
  | SpeakData
  | LoopData
  | ConditionData
  | ShutdownData
  | ReadAlarmData
  | PredictData
  | MaintenanceData
  | LogData

export interface SopNode {
  id: string
  type: SopNodeType
  position: { x: number; y: number }
  data: SopNodeData
}

export interface SopEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface Waypoint {
  x: number
  y: number
  name?: string
}

export interface SopGraph {
  id: string
  name: string
  industry: 'hotpot' | 'pharmacy' | 'mall' | 'factory' | 'other'
  brand: string
  model: string
  version?: number
  nodes: SopNode[]
  edges: SopEdge[]
  waypoints?: Record<string, Waypoint>
  alerts?: Record<string, unknown>
  createdAt: number
  updatedAt?: number
}

// 把画布数据导出成下发给机器人的 JSON
// 边按 source 聚合到每个 step 的 next 数组，省得真机再建邻接表
export function graphToPayload(graph: SopGraph): object {
  return {
    task_id: graph.id,
    brand: graph.brand,
    model: graph.model,
    steps: graph.nodes.map((n) => ({
      id: n.id,
      action: n.type,
      params: n.data,
      next: graph.edges.filter((e) => e.source === n.id).map((e) => e.target),
    })),
  }
}

// ────────────────────────────────────────────────────────────
// 火锅店晚市传菜 SOP · 完整版（18 节点，含开机/取托盘/条件/关机）
// 对应 SOP-HOTPOT.md 第二节
// ────────────────────────────────────────────────────────────
export const HOTPOT_DINNER_V1: SopGraph = {
  id: 'hotpot-dinner-v1',
  name: '火锅店晚市传菜 · 标准版',
  industry: 'hotpot',
  brand: 'keenon',
  model: 'peanut-v4',
  version: 1,
  createdAt: 1741584000000,
  waypoints: {
    A: { x: 0, y: 0, name: '传菜口' },
    B: { x: 5, y: 0, name: '3号桌' },
    C: { x: 5, y: 3, name: '7号桌' },
    D: { x: 0, y: 3, name: '5号桌' },
    E: { x: 8, y: 4, name: '充电桩' },
  },
  nodes: [
    { id: 'boot', type: 'boot', position: { x: 100, y: 50 }, data: { label: '开机自检', action: 'self_check', timeout: 30, onFail: 'alert' } },
    { id: 'charge_full', type: 'move', position: { x: 100, y: 150 }, data: { label: '回充电桩', target: 'E', speed: 0.6, waitForCharge: true, chargeTarget: 95 } },
    { id: 'goto_kitchen', type: 'move', position: { x: 100, y: 250 }, data: { label: '到传菜口待命', target: 'A', speed: 0.8, arrivalAction: 'wait_for_load' } },
    { id: 'wait_signal', type: 'wait', position: { x: 100, y: 350 }, data: { label: '等待出餐信号', trigger: 'kitchen_signal', timeout: 600, onTimeout: 'return_home' } },
    { id: 'loop_start', type: 'loop', position: { x: 350, y: 350 }, data: { label: '传菜循环', mode: 'time_range', startTime: '17:50', endTime: '20:30', maxRounds: 40, onComplete: 'slow_mode' } },
    { id: 'pick_tray', type: 'pickup', position: { x: 350, y: 250 }, data: { label: '取托盘', checkWeight: true, minWeight: 200, onEmpty: 'wait_reload' } },
    { id: 'goto_table3', type: 'move', position: { x: 600, y: 150 }, data: { label: '→ 3号桌', target: 'B', speed: 0.7, avoidPedestrian: true, minDistance: 0.6 } },
    { id: 'speak_table3', type: 'speak', position: { x: 600, y: 50 }, data: { label: '播报·3号桌', text: '您好，小心烫手～', volume: 0.8, waitAfter: 3 } },
    { id: 'goto_table7', type: 'move', position: { x: 600, y: 450 }, data: { label: '→ 7号桌', target: 'C', speed: 0.7, avoidPedestrian: true, minDistance: 0.6 } },
    { id: 'speak_table7', type: 'speak', position: { x: 600, y: 550 }, data: { label: '播报·7号桌', text: '您好，小心烫手～', volume: 0.8, waitAfter: 3 } },
    { id: 'goto_table5', type: 'move', position: { x: 350, y: 550 }, data: { label: '→ 5号桌', target: 'D', speed: 0.7, avoidPedestrian: true, minDistance: 0.6 } },
    { id: 'speak_table5', type: 'speak', position: { x: 350, y: 650 }, data: { label: '播报·5号桌', text: '您好，小心烫手～', volume: 0.8, waitAfter: 3 } },
    { id: 'return_kitchen', type: 'move', position: { x: 100, y: 650 }, data: { label: '回传菜口', target: 'A', speed: 0.8 } },
    { id: 'check_battery', type: 'condition', position: { x: 100, y: 750 }, data: { label: '电量检查', field: 'batteryPct', operator: '<', value: 30, onTrue: 'goto_charge', onFalse: 'loop_start' } },
    { id: 'goto_charge', type: 'move', position: { x: 100, y: 850 }, data: { label: '低电回充', target: 'E', speed: 0.9, waitForCharge: true, chargeMinutes: 15 } },
    { id: 'slow_mode', type: 'loop', position: { x: 350, y: 850 }, data: { label: '降频模式', mode: 'time_range', startTime: '20:30', endTime: '21:00', interval: 300, onComplete: 'shutdown' } },
    { id: 'shutdown', type: 'shutdown', position: { x: 350, y: 950 }, data: { label: '关机+发日报', sendReport: true, reportChannels: ['wechat', 'email'] } },
  ],
  edges: [
    { id: 'e1', source: 'boot', target: 'charge_full' },
    { id: 'e2', source: 'charge_full', target: 'goto_kitchen' },
    { id: 'e3', source: 'goto_kitchen', target: 'wait_signal' },
    { id: 'e4', source: 'wait_signal', target: 'loop_start' },
    { id: 'e5', source: 'loop_start', target: 'pick_tray' },
    { id: 'e6', source: 'pick_tray', target: 'goto_table3' },
    { id: 'e7', source: 'goto_table3', target: 'speak_table3' },
    { id: 'e8', source: 'speak_table3', target: 'goto_table7' },
    { id: 'e9', source: 'goto_table7', target: 'speak_table7' },
    { id: 'e10', source: 'speak_table7', target: 'goto_table5' },
    { id: 'e11', source: 'goto_table5', target: 'speak_table5' },
    { id: 'e12', source: 'speak_table5', target: 'return_kitchen' },
    { id: 'e13', source: 'return_kitchen', target: 'check_battery' },
    { id: 'e14', source: 'check_battery', target: 'loop_start', label: '≥30%' },
    { id: 'e15', source: 'check_battery', target: 'goto_charge', label: '<30%' },
    { id: 'e16', source: 'goto_charge', target: 'loop_start' },
    { id: 'e17', source: 'loop_start', target: 'slow_mode', label: '20:30到' },
    { id: 'e18', source: 'slow_mode', target: 'shutdown', label: '21:00到' },
  ],
}

// 简版模板（画布快速演示用，6 节点）
export const HOTPOT_DINNER_TEMPLATE: SopGraph = {
  id: 'sop-hotpot-dinner-001',
  name: '火锅店晚市传菜流程',
  industry: 'hotpot',
  brand: 'keenon',
  model: 'peanut',
  nodes: [
    { id: 'n1', type: 'move',  position: { x: 100, y: 200 }, data: { x: 0, y: 0, speed: 0.8, waypoints: [{ x: 0, y: 0 }, { x: 3, y: 0 }] } },
    { id: 'n2', type: 'wait',  position: { x: 300, y: 200 }, data: { seconds: 5 } },
    { id: 'n3', type: 'speak', position: { x: 500, y: 100 }, data: { text: '您的菜品到了，小心烫手～', volume: 0.8, lang: 'zh' } },
    { id: 'n4', type: 'move',  position: { x: 500, y: 300 }, data: { x: 3, y: 2, speed: 0.8 } },
    { id: 'n5', type: 'speak', position: { x: 700, y: 300 }, data: { text: '请慢用！', volume: 0.8, lang: 'zh' } },
    { id: 'n6', type: 'loop',  position: { x: 700, y: 500 }, data: { count: 20, breakCondition: 'batteryPct < 20' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5' },
    { id: 'e5', source: 'n5', target: 'n6', label: '回传菜口' },
  ],
  createdAt: 1711200000000,
  updatedAt: 1711200000000,
}
