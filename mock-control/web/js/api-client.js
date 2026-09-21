// mock-control/web/js/api-client.js
// Control Service REST API 封装 + SSE 订阅（对齐文档 §6.3）

export class ControlApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl // 同源部署留空即可
    this.eventSource = null
  }

  async getDevices() {
    const res = await fetch(`${this.baseUrl}/api/devices`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async getDevice(robotId) {
    const res = await fetch(`${this.baseUrl}/api/devices/${encodeURIComponent(robotId)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async getScenarios() {
    const res = await fetch(`${this.baseUrl}/api/scenario`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async sendCommand(robotId, type, params = {}) {
    const res = await fetch(`${this.baseUrl}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ robotId, type, params, source: 'control-panel' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  async startScenario(name) {
    const res = await fetch(`${this.baseUrl}/api/scenario/${encodeURIComponent(name)}/start`, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  async stopScenario() {
    const res = await fetch(`${this.baseUrl}/api/scenario/stop`, { method: 'POST' })
    return res.json()
  }

  // SSE 订阅：state / alert / scenario 三类事件
  subscribe({ onState, onAlert, onScenario, onOpen, onDisconnect }) {
    this.disconnect()
    this.eventSource = new EventSource(`${this.baseUrl}/api/telemetry/stream`)

    this.eventSource.onopen = () => onOpen?.()
    this.eventSource.onerror = () => onDisconnect?.() // 浏览器 EventSource 自动重连

    if (onState) this.eventSource.addEventListener('state', (e) => onState(JSON.parse(e.data)))
    if (onAlert) this.eventSource.addEventListener('alert', (e) => onAlert(JSON.parse(e.data)))
    if (onScenario) this.eventSource.addEventListener('scenario', (e) => onScenario(JSON.parse(e.data)))
  }

  disconnect() {
    this.eventSource?.close()
    this.eventSource = null
  }
}
