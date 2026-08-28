// 2026-08-18 自研 WS 客户端，支持指数退避重连+心跳+多 topic 订阅
export class RobotWSClient {
  private ws: WebSocket | null = null
  private reconnectTimer?: number
  private heartbeatTimer?: number
  private reconnectAttempts = 0
  private readonly maxReconnect = 10
  // 2026-08-28 主动断开标志：disconnect() 后 onclose 仍会触发，
  // 若不拦截会 scheduleReconnect 复活孤儿连接 → mock 端状态被多连接加速推进（电量 5 倍速递减实测）
  private disposed = false

  constructor(
    private url: string,
    private onMessage: (data: any) => void,
    private onStatusChange?: (online: boolean) => void
  ) {}

  connect() {
    try {
      console.log('[ws-client] 连接中:', this.url)
      this.ws = new WebSocket(this.url)
      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        console.log('[ws-client] 连接成功, 重置重连计数:', this.reconnectAttempts)
        this.onStatusChange?.(true)
        this.startHeartbeat()
      }
      this.ws.onmessage = (e) => {
        try { this.onMessage(JSON.parse(e.data)) }
        catch { console.warn('[ws-client] JSON 解析失败，丢弃帧') }
      }
      this.ws.onclose = () => {
        console.log('[ws-client] 连接关闭, 准备重连')
        this.onStatusChange?.(false)
        if (this.disposed) return // 2026-08-28 主动断开不重连，防止孤儿连接复活
        this.scheduleReconnect()
      }
      this.ws.onerror = () => {
        console.warn('[ws-client] WebSocket 错误, 触发 close')
        this.ws?.close()
      }
    } catch {
      console.warn('[ws-client] 构造异常, 进入重连')
      this.scheduleReconnect()
    }
  }

  send(topic: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ topic, data: payload }))
    }
  }

  disconnect() {
    this.disposed = true // 2026-08-28 先置位再关闭，拦截 onclose 引发的重连
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
    if (this.reconnectAttempts >= this.maxReconnect) {
      console.warn('[ws-client] 达到最大重连次数, 放弃:', this.maxReconnect)
      return
    }
    // 2026-08-19 指数退避+抖动，避免雪崩重连（1s→2s→4s→8s…最大 30s）
    const base = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
    const jitter = Math.random() * 500 // 0~500ms 抖动，避免雷同重连
    const delay = base + jitter
    this.reconnectAttempts++
    console.log('[ws-client] 调度重连:', { attempt: this.reconnectAttempts, delay: Math.round(delay) + 'ms' })
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
  }
}
