import { RobotWSClient, adaptIncoming, adaptIncomingAlert, adaptByBrandEnhanced, connectMqtt, adaptGps } from 'robot-adapter-kit'
import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'
import { useSpeakStore, type SpeakEvent } from '../stores/speakStore'
import { useOtaStore } from '../stores/otaStore'
import { useDemoStore } from '../stores/demoStore'
import { useFeedToastStore } from '../stores/feedToastStore'
import { statusLabel } from '../components/overlays/FeedToasts'
import { writeRobotState } from './robotStorage'
import { writeAlert } from './alertStorage'

// ── 订阅推送 toast（路演演示：让评审直观看到「消息到达 → 中台执行」）────
// 机器人友好名（toast 标题用，查不到回落 robotId）
const ROBOT_LABELS: Record<string, string> = {
  'g1-001': '宇树 G1',
  'peanut-001': '擎朗 Peanut',
  'FANUC_M20iD_001': 'FANUC M-20iD',
  'KUKA_KR6_001': 'KUKA KR 6',
  'ESTUN_ER3A_001': '埃斯顿 ER3A',
  'YASKAWA_GP7_001': '安川 GP7',
}

function robotLabel(id: string): string {
  return ROBOT_LABELS[id] ?? id
}

// 状态翻转 toast：prev → next，写入 store 前弹
function pushStatusToast(robotId: string, prev: string, next: string) {
  if (prev === next) return
  useFeedToastStore.getState().push({
    kind: 'status',
    robotId,
    title: robotLabel(robotId),
    detail: `${statusLabel(prev)} → ${statusLabel(next)}`,
    level: next === 'error' ? 'error' : next === 'charging' ? 'warn' : 'info',
  })
}

// 新告警 toast
function pushAlertToast(robotId: string, code: string, message: string, level: 'info' | 'warn' | 'error') {
  useFeedToastStore.getState().push({
    kind: 'alert',
    robotId,
    title: robotLabel(robotId),
    detail: `${code} ${message}`,
    level,
  })
}
// 2026-08-28 商用适配完成日志节流签名（robotId → 电量整数位:状态）
const lastAdaptedSig: Record<string, string> = {}
// toast 专用：商用上一帧状态（只跟踪 status 翻转，电量变化不弹）
const lastCommercialStatus: Record<string, string> = {}
// wsHub 初始化入口
// 这里先连 MQTT，把工业消息、OTA 状态回调都挂上去
connectMqtt(
  (state, alerts) => {
    const { updateRobot } = useRobotStore.getState();
    const { addAlert } = useAlertStore.getState();
    // 订阅推送：MQTT 通道状态翻转 / 新告警 toast（与 WS 共享去重 map）
    const prevStatus = lastIndustrialStatus[state.robotId];
    if (prevStatus !== undefined) {
      pushStatusToast(state.robotId, prevStatus, state.status);
    }
    lastIndustrialStatus[state.robotId] = state.status;
    alerts.forEach((a) => {
      pushAlertToast(state.robotId, a.code, a.message, a.level);
    });
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
// 工业流现在是 8 帧/s 的运动仿真，每帧都打日志会刷爆 console，
// 用「robotId:状态:告警数」签名节流，变化了才打
const lastIndustrialSig: Record<string, string> = {}
// toast 专用：上一帧状态（与日志签名分离，只跟踪 status 翻转）
const lastIndustrialStatus: Record<string, string> = {}
function handleIndustrialMessage(msg: any) {
  try {
    const { state, alerts } = adaptByBrandEnhanced(msg.brand, msg.payload)
    const sig = `${state.robotId}:${state.status}:${alerts.length}`
    if (lastIndustrialSig[state.robotId] !== sig) {
      lastIndustrialSig[state.robotId] = sig
      console.log('[wsHub] 工业消息:', { brand: msg.brand, robotId: state.robotId, status: state.status, alertCount: alerts.length })
    }
    // 订阅推送：状态翻转时 toast（高频帧静默，只弹变化）
    const prevStatus = lastIndustrialStatus[state.robotId]
    if (prevStatus !== undefined) {
      pushStatusToast(state.robotId, prevStatus, state.status)
    }
    lastIndustrialStatus[state.robotId] = state.status
    // 订阅推送：新告警 toast（store 内置 5s 同码去重）
    alerts.forEach((a) => {
      pushAlertToast(state.robotId, a.code, a.message, (a.level as 'info' | 'warn' | 'error') || 'warn')
    })
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
          // 2026-09-07 一键演示剧本状态分流（mock 剧本 → demoStore → 舰队页演示横幅）
          if (raw?.type === 'demo_status') {
            useDemoStore.getState().updateFromFrame(raw)
            return
          }

          if (isSpeakMessage(raw)) {
            handleSpeak(raw, robotId)
          } else if (isAlertMessage(brand, raw)) {
            const alert = adaptIncomingAlert(brand, raw, robotId)
            if (alert) {
              // 订阅推送：新告警 toast
              pushAlertToast(alert.robotId || robotId, alert.code, alert.message, alert.level)
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
            // 订阅推送：状态翻转 toast（与日志签名分离，电量变化不弹）
            const prevStatus = lastCommercialStatus[robotId]
            if (prevStatus !== undefined) {
              pushStatusToast(robotId, prevStatus, state.status)
            }
            lastCommercialStatus[robotId] = state.status
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

// 一键演示触发指令：走工业通道（8082 的 industrial-hub 连接，mock 端剧本入口）
// 工业四台共用一条 WS 连接，不能按单机 robotId 找 client
export function sendDemoTrigger(robotId: string): boolean {
  const client = clients.get('industrial-hub')
  if (!client) {
    console.warn('[wsHub] sendDemoTrigger 失败：工业通道未连接')
    return false
  }
  client.send('/demo', { robotId })
  return true
}
