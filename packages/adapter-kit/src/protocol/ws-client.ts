// 通用 WebSocket 客户端（重连/心跳/多 topic 订阅）
export class RobotWSClient {
  private ws: WebSocket | null = null
  private reconnectTimer?: number
  private heartbeatTimer?: number
  private reconnectAttempts = 0
  private readonly maxReconnect = 10

  constructor(
    private url: string,
    private onMessage: (data: any) => void,
    private onStatusChange?: (online: boolean) => void
  ) {}

  connect() {
    try {
      this.ws = new WebSocket(this.url)
      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.onStatusChange?.(true)
        this.startHeartbeat()
      }
      this.ws.onmessage = (e) => {
        try { this.onMessage(JSON.parse(e.data)) }
        catch { /* ignore malformed */ }
      }
      this.ws.onclose = () => {
        this.onStatusChange?.(false)
        this.scheduleReconnect()
      }
      this.ws.onerror = () => this.ws?.close()
    } catch {
      this.scheduleReconnect()
    }
  }

  send(topic: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ topic, data: payload }))
    }
  }

  disconnect() {
    clearTimeout(this.reconnectTimer)
    clearInterval(this.heartbeatTimer)
    this.ws?.close()
  }

  private startHeartbeat() {
    this.heartbeatTimer = window.setInterval(() => {
      this.send('__ping__', { t: Date.now() })
    }, 15000)
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnect) return
    // 指数退避 + 抖动（1s → 2s → 4s → 8s → … 最大 30s）
    const base = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
    const jitter = Math.random() * 500 // 0~500ms 抖动，避免雷同重连
    const delay = base + jitter
    this.reconnectAttempts++
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
  }
}
