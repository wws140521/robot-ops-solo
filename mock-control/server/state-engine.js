// mock-control/server/state-engine.js
// 状态引擎：6 台设备的内存状态树（结构对齐 adapter-kit 的 UnifiedRobotState 子集）
// 两个写入来源：
//   1. apply(command)      —— 控制面板指令（人主动改状态）
//   2. applyTelemetry(...) —— mock-ws-server 遥测回传（被动同步真实仿真值）
// 每次变更通过 EventEmitter 广播 'change'，SSE 路由转给浏览器。

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { EventEmitter } from 'node:events'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 告警码中文描述池（对齐 mock-ws-server 的 INDUSTRIAL_ALARM_POOLS 常用码）
const ALARM_DESC = {
  'SRVO-001': '伺服放大器过流',
  'SRVO-023': '伺服过载（J2 轴电机过热）',
  'SRVO-062': '伺服放大器过热',
  'OH-002': '变频器散热器过热',
  'KSS-004': 'KSS 轴工作范围超限',
  'KSS-150': '伺服过载',
  'EST-007': 'Estun 通信超时',
  'EST-3008': '编码器异常',
  'ALM-201': 'Yaskawa 绝对位置丢失',
}

export class StateEngine extends EventEmitter {
  constructor(configPath) {
    super()
    this.devices = new Map() // robotId → MockDeviceState
    this.config = null
    this.configPath = configPath || resolve(__dirname, '../config/devices.yaml')
  }

  async init() {
    const raw = readFileSync(this.configPath, 'utf-8')
    this.config = YAML.parse(raw)
    this.config.devices.forEach((def) => {
      this.devices.set(def.robotId, this.createInitialState(def))
    })
    return this
  }

  createInitialState(def) {
    const state = {
      robotId: def.robotId,
      name: def.name,
      brand: def.brand,
      deviceClass: def.deviceClass,
      wsPort: def.wsPort ?? 8082,
      online: true,
      status: def.initialStatus || 'idle',
      // 工业臂显式配 null（无电池），商用默认 80——不能用 ??，它会把 null 也兜成 80
      battery: def.initialBattery !== undefined ? def.initialBattery : 80,
      healthScore: def.initialHealth ?? 90,
      mode: 'auto',
      lastUpdate: Date.now(),
      source: 'mock-control',
    }

    // 工业机械臂：初始化 6 轴关节（角度/温度/负载基线取自 mock-ws-server 的仿真配置）
    if (def.deviceClass === 'industrial_arm') {
      state.joints = this.defaultJoints(def.brand)
      state.alarms = []
    }

    // 低空设备：初始化机巢/起降场状态（v1.1 扩展）
    if (def.deviceClass === 'aerial_dock') {
      state.dockState = {
        doorOpen: false, charging: true,
        liftPosition: 0, temperature: 25, uavBattery: 100,
      }
    }
    if (def.deviceClass === 'vertiport') {
      state.vertiportState = {
        chargingPadOnline: true, fireSuppressionArmed: true, lightingActive: true,
      }
    }
    return state
  }

  // 各品牌 6 轴基线（温度/负载抄 mock-ws-server ROBOT_SIM_CFG，保证初值和遥测对得上）
  defaultJoints(brand) {
    const presets = {
      fanuc:   { temp: [41, 67, 38, 35, 33, 31], load: [72, 62, 38, 30, 25, 18], angle: [0, 0.3, -0.5, 0, 0.2, 0] },
      kuka:    { temp: [36, 42, 37, 32, 30, 28], load: [35, 55, 40, 22, 18, 12], angle: [0, 0.45, -0.35, 0, -0.1, 0] },
      estun:   { temp: [34, 39, 36, 31, 29, 27], load: [28, 42, 35, 20, 15, 10], angle: [0, 0.25, -0.4, 0, 0.15, 0] },
      yaskawa: { temp: [35, 40, 37, 32, 30, 28], load: [33, 48, 38, 24, 16, 11], angle: [0, 0.35, -0.6, 0, 0.25, 0] },
    }
    const p = presets[brand] || presets.fanuc
    return p.angle.map((rad, i) => ({
      axis: i + 1,
      name: `J${i + 1}`,
      angle: +((rad * 180) / Math.PI).toFixed(2), // UI 用度数
      temperature: p.temp[i],
      load: p.load[i],
      current: +(1.2 + i * 0.3).toFixed(1),
      status: 'normal',
    }))
  }

  get(robotId) { return this.devices.get(robotId) }
  getAll() { return Array.from(this.devices.values()) }
  size() { return this.devices.size }

  // ── 指令应用（人主动改）──────────────────────────────
  apply(command) {
    const device = this.devices.get(command.robotId)
    if (!device) throw new Error(`Device "${command.robotId}" not found`)

    switch (command.type) {
      case 'start':      device.status = 'working'; break
      case 'stop':       device.status = 'idle'; break
      case 'pause':      device.status = 'idle'; break
      case 'resume':     device.status = 'working'; break
      case 'reset':      this.resetDevice(device); break

      case 'set_battery':
        device.battery = clamp(command.params.level, 0, 100)
        break

      case 'set_health_score':
        device.healthScore = clamp(command.params.score, 0, 100)
        break

      case 'set_joint_temperature': {
        const { axis, temperature } = command.params
        const joint = device.joints?.find((j) => j.axis === axis)
        if (joint) {
          joint.temperature = temperature
          joint.status = temperature > 75 ? 'fault' : temperature > 60 ? 'warning' : 'normal'
        }
        this.recalcHealthScore(device)
        break
      }

      case 'set_joint_angle': {
        const { axis, angle } = command.params
        const joint = device.joints?.find((j) => j.axis === axis)
        if (joint) joint.angle = angle
        break
      }

      case 'set_load': {
        const { axis, load } = command.params
        const joint = device.joints?.find((j) => j.axis === axis)
        if (joint) joint.load = clamp(load, 0, 150)
        break
      }

      case 'trigger_alarm': {
        const { code, severity = 'warn' } = command.params
        device.alarms = device.alarms || []
        device.alarms.push({
          code, severity,
          zh_desc: this.getAlarmDescription(code),
          ts: Date.now(),
        })
        if (severity === 'error') device.status = 'error'
        break
      }

      case 'clear_alarm': {
        const { code } = command.params || {}
        if (code) {
          device.alarms = (device.alarms || []).filter((a) => a.code !== code)
        } else {
          device.alarms = []
        }
        if (device.status === 'error') device.status = 'working'
        break
      }

      case 'set_mode':
        device.mode = command.params.mode === 'manual' ? 'manual' : 'auto'
        break

      case 'simulate_offline': {
        device.online = false
        const duration = command.params.duration_ms || 30000
        const timer = setTimeout(() => {
          device.online = true
          this.emitChange(device)
        }, duration)
        // 防止句柄挂着阻碍测试退出
        if (timer.unref) timer.unref()
        break
      }

      case 'inject_fault': {
        // 硬件故障模拟：直接压低健康分 + 触发对应描述的告警
        const faultType = command.params.type || 'unknown'
        device.healthScore = Math.max(0, device.healthScore - 20)
        device.alarms = device.alarms || []
        device.alarms.push({
          code: `FAULT-${faultType}`,
          severity: 'error',
          zh_desc: `注入硬件故障: ${faultType}`,
          ts: Date.now(),
        })
        device.status = 'error'
        break
      }

      case 'custom_telemetry': {
        const patch = command.params.patch || {}
        // 浅合并进设备状态（调试用，允许覆盖任意展示字段）
        Object.assign(device, sanitizePatch(patch))
        break
      }

      // 商用运动类指令：本地只记录意图，真实位移由 mock-ws-server 仿真推进
      case 'move_to':
      case 'set_velocity':
      case 'return_to_charge':
        break

      default:
        throw new Error(`Unknown command type: ${command.type}`)
    }

    device.lastUpdate = Date.now()
    this.emitChange(device)
    return device
  }

  // ── 遥测同步（被动改，来自 mock-ws-server 的 WS 帧）──────────
  applyTelemetry(robotId, patch) {
    const device = this.devices.get(robotId)
    if (!device) return

    if (patch.battery !== undefined && device.battery !== null) device.battery = patch.battery
    if (patch.status !== undefined && patch.status !== null) device.status = patch.status
    if (patch.online !== undefined) device.online = patch.online
    if (patch.position && typeof patch.position.x === 'number') device.position = patch.position
    if (patch.heading !== undefined) device.heading = patch.heading

    if (patch.joints) {
      // 关节遥测：角度/温度/负载跟随仿真，健康分不覆盖（由本地温度算法驱动）
      if (!device.joints) device.joints = []
      patch.joints.forEach((jt) => {
        const joint = device.joints.find((j) => j.axis === jt.axis)
        if (joint) {
          joint.angle = jt.angle ?? joint.angle
          joint.temperature = jt.temperature ?? joint.temperature
          joint.load = jt.load ?? joint.load
          joint.current = jt.current ?? joint.current
          joint.status = jt.temperature > 75 ? 'fault' : jt.temperature > 60 ? 'warning' : 'normal'
        }
      })
    }

    // 遥测里的告警是一次性事件帧（模拟真实报警码）：追加进本地活动列表
    if (patch.alarmEvents && patch.alarmEvents.length) {
      device.alarms = device.alarms || []
      patch.alarmEvents.forEach((a) => {
        device.alarms.push({
          code: a.raw_code,
          severity: a.severity === 'warning' ? 'warn' : a.severity,
          zh_desc: a.zh_desc,
          ts: Date.now(),
        })
        if (a.severity === 'error') device.status = 'error'
      })
      this.emit('alert', { robotId, alarms: patch.alarmEvents })
    }

    device.lastUpdate = Date.now()
    this.emitChange(device)
  }

  recalcHealthScore(device) {
    if (!device.joints?.length) return
    const avgTemp = device.joints.reduce((s, j) => s + j.temperature, 0) / device.joints.length
    // 对齐 health/index.ts 的思路：温度越高健康分越低（40℃ 起算，每度扣 2 分）
    device.healthScore = Math.max(0, Math.round(100 - Math.max(0, avgTemp - 40) * 2))
  }

  getAlarmDescription(code) {
    return ALARM_DESC[code] || `未知告警: ${code}`
  }

  resetDevice(device) {
    const def = this.config.devices.find((d) => d.robotId === device.robotId)
    device.status = def?.initialStatus || 'idle'
    device.battery = def?.initialBattery !== undefined ? def.initialBattery : 80 // null（工业臂无电池）要原样保留
    device.healthScore = def?.initialHealth ?? 90
    device.alarms = []
    device.online = true
    device.mode = 'auto'
    if (device.joints) {
      device.joints = this.defaultJoints(device.brand)
    }
  }

  // 全部设备复位（"🔄 全部复位"按钮）
  resetAll() {
    this.devices.forEach((device) => {
      this.resetDevice(device)
      device.lastUpdate = Date.now()
      this.emitChange(device)
    })
  }

  emitChange(device) {
    this.emit('change', device)
  }
}

function clamp(v, min, max) {
  const n = Number(v)
  if (Number.isNaN(n)) throw new Error(`参数必须是数字: ${v}`)
  return Math.max(min, Math.min(max, n))
}

// custom_telemetry 的 patch 只允许覆盖展示层字段，防止指令把 robotId/source 改坏
const PATCHABLE_FIELDS = new Set([
  'name', 'status', 'battery', 'healthScore', 'mode', 'online', 'position', 'heading',
])
function sanitizePatch(patch) {
  const out = {}
  for (const [k, v] of Object.entries(patch)) {
    if (PATCHABLE_FIELDS.has(k)) out[k] = v
  }
  return out
}
