import { RobotWSClient, adaptIncoming, adaptIncomingAlert, adaptByBrandEnhanced, connectMqtt } from 'robot-adapter-kit'
import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'
import { useSpeakStore, type SpeakEvent } from '../stores/speakStore'
import { writeRobotState } from './robotStorage'
import { writeAlert } from './alertStorage'
// 工业品牌集合
const INDUSTRIAL_BRANDS = new Set(['fanuc', 'kuka', 'estun', 'yaskawa'])
// 在 wsHub 初始化函数里（你现有的 initWS 或 startWS 里）加这几行：
connectMqtt((state, alerts) => {
  const { updateRobot } = useRobotStore.getState();
  const { addAlert } = useAlertStore.getState();
  updateRobot(state.robotId, state);
  if (alerts.length > 0) {
    alerts.forEach((a) => addAlert(a));
  }
});
// 处理工业遥测消息（industrial_state / industrial_alert）
function handleIndustrialMessage(msg: any) {
  try {
    const { state, alerts } = adaptByBrandEnhanced(msg.brand, msg.payload)
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

// 按 robotId 索引，便于 SOP / 仪表盘反向控制定位连接
const clients: Map<string, RobotWSClient> = new Map()

// 连接状态：'connected' | 'reconnecting' | 'disconnected'
type ConnState = 'connected' | 'reconnecting' | 'disconnected'
const connStates: Map<string, ConnState> = new Map()
const connListeners: Set<() => void> = new Set()

export function getConnStates(): Record<string, ConnState> {
  return Object.fromEntries(connStates)
}

export function subscribeConnState(fn: () => void): () => void {
  connListeners.add(fn)
  return () => connListeners.delete(fn)
}

function setConnState(robotId: string, state: ConnState) {
  connStates.set(robotId, state)
  connListeners.forEach((fn) => fn())
}

export function getOverallConnState(): ConnState {
  const states = Array.from(connStates.values())
  if (states.length === 0) return 'disconnected'
  if (states.some((s) => s === 'reconnecting')) return 'reconnecting'
  if (states.every((s) => s === 'connected')) return 'connected'
  return 'disconnected'
}

// 是否为播报主题帧（/speak）
function isSpeakMessage(raw: any): boolean {
  return raw?.topic === '/speak'
}

// 是否为告警主题帧（状态帧 vs 告警帧分流，避免告警帧污染状态）
function isAlertMessage(brand: string, raw: any): boolean {
  if (brand === 'unitree') return raw?.topic === '/alert'
  if (brand === 'keenon') return raw?.cmd === 'alert'
  return false
}

// 处理 /speak：1. 写 speakStore 驱动气泡 2. 写 alertStore(info) 进告警流 3. 浏览器 TTS 朗读
function handleSpeak(raw: any, robotId: string) {
  const speakEvent: SpeakEvent = {
    robotId,
    text: raw.data?.text ?? '',
    volume: raw.data?.volume ?? 0.8,
    timestamp: raw.data?.timestamp ?? Date.now(),
  }

  useSpeakStore.getState().setSpeak(speakEvent)

  const speakAlert = {
    robotId,
    level: 'info' as const,
    code: 'SPEAK',
    message: `🔊 播报: "${speakEvent.text}"`,
    timestamp: speakEvent.timestamp,
  }
  useAlertStore.getState().addAlert(speakAlert)
  writeAlert(speakAlert) // 写入 Supabase alerts 表（离线模式自动跳过）

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

// 启动一组 WS 连接（每条连接对应一台机器人）
export function startWS(connections: WsConnection[]) {
  connections.forEach(({ brand, url, robotId }) => {
    const client = new RobotWSClient(
      url,
      (raw) => {
        try {
          // 工业消息分流（type: industrial_state / industrial_alert）
          if (raw?.type === 'industrial_state' || raw?.type === 'industrial_alert') {
            handleIndustrialMessage(raw)
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

export function stopAllWS() {
  clients.forEach((c) => c.disconnect())
  clients.clear()
}

// SOP / 仪表盘 → 机器人反向控制：下发指令到指定 robotId
// 例：sendCommand('peanut-001', '/speak', { text: '欢迎光临', volume: 0.8 })
//     sendCommand('g1-001', '/move', { target: 'B', speed: 0.7 })
export function sendCommand(robotId: string, topic: string, payload: any): boolean {
  const client = clients.get(robotId)
  if (!client) {
    console.warn(`[wsHub] sendCommand 失败：未找到机器人 ${robotId}`)
    return false
  }
  client.send(topic, payload)
  return true
}
