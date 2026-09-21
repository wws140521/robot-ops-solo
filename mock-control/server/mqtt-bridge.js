// mock-control/server/mqtt-bridge.js
// 双向桥接：把 Control Service 的指令送到 mock-ws-server，把遥测收回 StateEngine
//
// 下行（指令）双模式自动降级：
//   1. MQTT 模式   —— 本地 mosquitto 可用时，发布 industrial/robot/{id}/command
//   2. WS 直连模式 —— 无 broker 时，作为 WebSocket 客户端连 :8080/:8081/:8082
//                     发 { topic: '/control', data: command }（与 /demo 同协议）
// 上行（遥测）始终走 WS 订阅（mock-ws-server 的遥测只广播 WS，不走 MQTT）。

import mqtt from 'mqtt'
import WebSocket from 'ws'

const WS_PORTS = [8080, 8081, 8082] // G1 / Peanut / 工业
const RECONNECT_MS = 2000

export class MqttBridge {
  constructor(stateEngine, opts = {}) {
    this.state = stateEngine
    this.mqttUrl = opts.mqttUrl || process.env.MQTT_BROKER || 'mqtt://localhost:1883'
    this.wsBaseUrl = opts.wsBaseUrl || process.env.MOCK_WS_URL || 'ws://localhost'
    this.mqttClient = null
    this.mqttReady = false
    this.wsClients = new Map() // port → WebSocket
    this.commandLog = []      // 最近 200 条指令（GET /api/commands 查询用）
  }

  async start() {
    this.connectMqtt()
    WS_PORTS.forEach((port) => this.connectWs(port))
  }

  // ── MQTT 连接（可选）────────────────────────────
  connectMqtt() {
    try {
      this.mqttClient = mqtt.connect(this.mqttUrl, {
        clientId: `mock-control-${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        connectTimeout: 3000,
        reconnectPeriod: 5000,
      })

      this.mqttClient.on('connect', () => {
        this.mqttReady = true
        console.log(`[MQTT] Connected to ${this.mqttUrl}（指令走 MQTT 通道）`)
        // 订阅遥测（真实 edge 部署时有用；mock 模式下遥测走 WS）
        this.mqttClient.subscribe('industrial/robot/+/telemetry', { qos: 0 })
      })
      this.mqttClient.on('error', () => { /* broker 不在也正常，走 WS 直连 */ })
      this.mqttClient.on('offline', () => { this.mqttReady = false })
      this.mqttClient.on('close', () => { this.mqttReady = false })

      this.mqttClient.on('message', (topic, payload) => {
        if (topic.endsWith('/telemetry')) {
          try {
            const t = JSON.parse(payload.toString())
            if (t?.robotId) this.state.applyTelemetry(t.robotId, t)
          } catch { /* 忽略坏帧 */ }
        }
      })
    } catch (e) {
      console.warn('[MQTT] 初始化失败，使用 WS 直连模式:', e.message)
    }
  }

  // ── WS 客户端（遥测订阅 + 指令直连备用通道）────────────
  connectWs(port) {
    const ws = new WebSocket(`${this.wsBaseUrl}:${port}`)
    this.wsClients.set(port, ws)

    ws.on('open', () => {
      console.log(`[WS] Connected to :${port}（遥测订阅中）`)
    })

    ws.on('message', (buf) => {
      try {
        this.handleTelemetryFrame(port, JSON.parse(buf.toString()))
      } catch { /* 非 JSON 帧忽略 */ }
    })

    ws.on('close', () => {
      this.wsClients.set(port, null)
      setTimeout(() => this.connectWs(port), RECONNECT_MS) // mock-ws-server 重启后自动重连
    })
    ws.on('error', () => { /* close 会跟着触发，重连交给 close */ })
    return ws
  }

  // 解析三种端口的遥测帧格式，统一转成 applyTelemetry patch
  handleTelemetryFrame(port, msg) {
    // G1（:8080）：{ topic: '/state', data: { percentage, position: {x,y,yaw}, ... } }
    if (port === 8080 && msg?.topic === '/state') {
      const d = msg.data || {}
      this.state.applyTelemetry('UNITREE-G1-01', {
        battery: d.percentage,
        position: d.position ? { x: d.position.x, y: d.position.y, z: 0 } : undefined,
        heading: d.position?.yaw !== undefined ? (d.position.yaw * 180) / Math.PI : undefined,
        // 商用帧不带 status，本地状态由指令驱动，遥测不覆盖
      })
      return
    }

    // Peanut（:8081）：{ cmd: 'state', payload: { level, x, y, angle } }
    if (port === 8081 && msg?.cmd === 'state') {
      const p = msg.payload || {}
      this.state.applyTelemetry('KEENON-T9-01', {
        battery: p.level,
        position: { x: p.x, y: p.y, z: 0 },
        heading: p.angle,
      })
      return
    }

    // 工业（:8082）：{ type: 'industrial_state', payload: { robot_id, status, joints, alarms } }
    if (port === 8082 && msg?.type === 'industrial_state') {
      const p = msg.payload || {}
      if (!p.robot_id) return
      this.state.applyTelemetry(p.robot_id, {
        status: p.status,
        joints: (p.joints || []).map((jt) => ({
          axis: jt.j,
          angle: jt.angle_rad !== undefined ? +((jt.angle_rad * 180) / Math.PI).toFixed(2) : undefined,
          temperature: jt.temp_c,
          load: jt.load_pct,
          current: jt.current_a,
        })),
        alarmEvents: p.alarms || [],
      })
    }
  }

  // ── 下行：指令发送（MQTT 优先，WS 直连兜底）────────────
  // 返回 delivery 信息给操作页面日志展示，路演时评审能看到指令走的哪条通道
  async sendCommand(command) {
    this.commandLog.push({ ...command, ts: Date.now() })
    if (this.commandLog.length > 200) this.commandLog.shift()

    if (this.mqttReady && this.mqttClient?.connected) {
      const topic = `industrial/robot/${command.robotId}/command`
      this.mqttClient.publish(topic, JSON.stringify(command), { qos: 1 })
      return { transport: 'mqtt', topic }
    }

    // WS 直连：按设备 wsPort 路由（工业=8082，G1=8080，Peanut=8081）
    const device = this.state.get(command.robotId)
    const port = device?.wsPort || 8082
    const ws = this.wsClients.get(port)
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ topic: '/control', data: command }))
      return { transport: 'ws', topic: `/control @ ws://localhost:${port}` }
    }
    // 连 mock-ws-server 都没开：静默丢弃（本地状态树已经改了，操作页面自身仍可用）
    return { transport: 'none', topic: null }
  }

  // ── 告警广播（MQTT 模式下生效；无 broker 时 SSE 兜底）────
  async publishAlert(alert) {
    if (this.mqttReady && this.mqttClient?.connected) {
      this.mqttClient.publish('alerts/broadcast', JSON.stringify(alert), { qos: 1 })
    }
  }

  getRecentCommands() {
    return [...this.commandLog].reverse()
  }

  transportMode() {
    return this.mqttReady ? 'mqtt' : 'websocket'
  }

  disconnect() {
    this.mqttClient?.end(true)
    this.wsClients.forEach((ws) => ws?.close())
  }
}
