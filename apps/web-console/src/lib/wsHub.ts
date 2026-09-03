import { RobotWSClient, adaptIncoming, adaptIncomingAlert, adaptByBrandEnhanced, connectMqtt, adaptGps } from 'robot-adapter-kit'
import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'
import { useSpeakStore, type SpeakEvent } from '../stores/speakStore'
import { useOtaStore } from '../stores/otaStore'
import { writeRobotState } from './robotStorage'
import { writeAlert } from './alertStorage'
// 2026-08-18 工业品牌集合
const INDUSTRIAL_BRANDS = new Set(['fanuc', 'kuka', 'estun', 'yaskawa'])
// 2026-08-28 商用适配完成日志节流签名（robotId → 电量整数位:状态）
const lastAdaptedSig: Record<string, string> = {}
// wsHub 初始化入口
// 这里先连 MQTT，把工业消息、OTA 状态回调都挂上去
connectMqtt(
  (state, alerts) => {
    const { updateRobot } = useRobotStore.getState();
    const { addAlert } = useAlertStore.getState();
    updateRobot(state.robotId, state);
    if (alerts.length > 0) {
      alerts.forEach((a) => addAlert(a));
    }
  },
  (robotId, state, progress, message, campaignId) => {
    console.log('[wsHub] OTA status 路由:', { robotId, state, progress })
    useOtaStore.getState().updateFromBackend(
      robotId,
      state as any, progress, message, campaignId
    )
  }
);

// 处理工业遥测消息，industrial_state 写状态，industrial_alert 只写告警
function handleIndustrialMessage(msg: any) {
  try {
    console.log('[wsHub] handleIndustrialMessage:', { type: msg.type, brand: msg.brand, payloadKeys: Object.keys(msg.payload ?? {}) })
    const { state, alerts } = adaptByBrandEnhanced(msg.brand, msg.payload)
    console.log('[wsHub] adaptByBrandEnhanced 完成:', { robotId: state.robotId, status: state.status, battery: state.batteryPct, alertCount: alerts.length })
    if (msg.type === 'industrial_state') {
      useRobotStore.getState().updateRobot(state.robotId, state)
      writeRobotState(state, msg.payload)
      if (alerts.length > 0) {
        alerts.forEach((a) => {
          useAlertStore.getState().addAlert(a)
          writeAlert(a)
        })
      }
    } else if (msg.type === 'industrial_alert') {
      if (alerts.length > 0) {
        alerts.forEach((a) => {
          useAlertStore.getState().addAlert(a)
          writeAlert(a)
        })
      }
    }
  } catch (err) {
    console.error('[wsHub] industrial message adapt failed:', err)
  }
}

interface WsConnection {
  brand: string
  url: string
  robotId: string
}

// 按 robotId 索引 WS 客户端，SOP / 仪表盘下发指令时要用
const clients: Map<string, RobotWSClient> = new Map()

// WS 连接状态：已连 / 重连中 / 断开
type ConnState = 'connected' | 'reconnecting' | 'disconnected'
const connStates: Map<string, ConnState> = new Map()
const connListeners: Set<() => void> = new Set()

// 返回所有连接状态，给调试或状态页用
export function getConnStates(): Record<string, ConnState> {
  return Object.fromEntries(connStates)
}

// 订阅整体连接状态变化，Sidebar 底部小圆点靠这个更新
export function subscribeConnState(fn: () => void): () => void {
  connListeners.add(fn)
  return () => connListeners.delete(fn)
}

// 更新单条连接状态并通知订阅者
function setConnState(robotId: string, state: ConnState) {
  connStates.set(robotId, state)
  connListeners.forEach((fn) => fn())
}

// 综合所有连接的状态：有重连就显示重连，全连才显示已连
export function getOverallConnState(): ConnState {
  const states = Array.from(connStates.values())
  if (states.length === 0) return 'disconnected'
  if (states.some((s) => s === 'reconnecting')) return 'reconnecting'
  if (states.every((s) => s === 'connected')) return 'connected'
  return 'disconnected'
}

// 判断是不是播报主题帧 /speak
function isSpeakMessage(raw: any): boolean {
  return raw?.topic === '/speak'
}

// 状态帧和告警帧分流，避免告警帧把电量状态覆盖掉
function isAlertMessage(brand: string, raw: any): boolean {
  if (brand === 'unitree') return raw?.topic === '/alert'
  if (brand === 'keenon') return raw?.cmd === 'alert'
  return false
}

// 处理 /speak：瞬时播报事件，驱动气泡、TTS、历史记录
// 这种不进 alertStore，alertStore 留给需要跟进的工业告警
function handleSpeak(raw: any, robotId: string) {
  const speakEvent: SpeakEvent = {
    robotId,
    text: raw.data?.text ?? '',
    volume: raw.data?.volume ?? 0.8,
    timestamp: raw.data?.timestamp ?? Date.now(),
  }

  useSpeakStore.getState().setSpeak(speakEvent)

  // 浏览器 TTS（零成本，演示效果）
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(speakEvent.text)
      utterance.lang = 'zh-CN'
      utterance.volume = speakEvent.volume
      utterance.rate = 1.0
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn('[wsHub] TTS 失败', e)
    }
  }

  console.log('[wsHub] 播报触发:', speakEvent.text)
}

// 启动一组 WS 连接，每条连接对应一台机器人
export function startWS(connections: WsConnection[]) {
  connections.forEach(({ brand, url, robotId }) => {
    const client = new RobotWSClient(
      url,
      (raw) => {
        try {
          // 2026-08-19 工业消息分流（type: industrial_state / industrial_alert）
          if (raw?.type === 'industrial_state' || raw?.type === 'industrial_alert') {
            console.log('[wsHub] 工业消息分流:', raw.type, raw.brand)
            handleIndustrialMessage(raw)
            return
          }
          // 2026-08-29 室外 GPS 帧分流
          if (raw?.topic === '/gps') {
            const state = adaptGps(raw.data)
            useRobotStore.getState().updateRobot(state.robotId, state)
            return
          }
          // 2026-08-21 OTA 状态分流（type: ota_status，mock 模式通过 WS 携带）
          if (raw?.type === 'ota_status') {
            console.log('[wsHub] OTA 状态分流:', { robotId: raw.robotId, state: raw.state, progress: raw.progress })
            useOtaStore.getState().updateFromBackend(
              raw.robotId, raw.state, raw.progress, raw.message, raw.campaign_id
            )
            return
          }

          if (isSpeakMessage(raw)) {
            handleSpeak(raw, robotId)
          } else if (isAlertMessage(brand, raw)) {
            const alert = adaptIncomingAlert(brand, raw, robotId)
            if (alert) {
              useAlertStore.getState().addAlert(alert)
              writeAlert(alert) // 写入 Supabase alerts 表（离线模式自动跳过）
            }
          } else {
            const state = adaptIncoming(brand, raw, robotId)
            // 2026-08-28 节流：仅在电量整数位或状态变化时打印，避免高频帧刷满 console 缓冲区
            const sig = `${robotId}:${state.batteryPct | 0}:${state.status}`
            if (lastAdaptedSig[robotId] !== sig) {
              lastAdaptedSig[robotId] = sig
              console.log('[wsHub] 商用适配完成:', { robotId, brand, status: state.status, battery: state.batteryPct })
            }
            useRobotStore.getState().updateRobot(robotId, state)
            writeRobotState(state, raw) // 写入 Supabase robot_states 表（离线模式自动跳过）
          }
        } catch (e) {
          console.warn(`[wsHub] adapt failed for ${brand}:`, e)
        }
      },
      (online) => {
        if (online) {
          setConnState(robotId, 'connected')
        } else {
          setConnState(robotId, 'reconnecting')
          useRobotStore.getState().setOffline(robotId)
        }
      }
    )
    client.connect()
    clients.set(robotId, client)
  })
}

// 停止所有 WS 连接
export function stopAllWS() {
  clients.forEach((c) => c.disconnect())
  clients.clear()
}

// SOP / 仪表盘 下发指令到指定机器人
// 比如 sendCommand('peanut-001', '/speak', { text: '欢迎光临' })
export function sendCommand(robotId: string, topic: string, payload: any): boolean {
  const client = clients.get(robotId)
  if (!client) {
    console.warn(`[wsHub] sendCommand 失败：未找到机器人 ${robotId}`)
    return false
  }
  console.log('[wsHub] sendCommand:', { robotId, topic, payload })
  client.send(topic, payload)
  return true
}
