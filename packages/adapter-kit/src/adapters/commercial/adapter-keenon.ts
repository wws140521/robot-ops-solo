import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified'

// 2026-08-18 对接擎朗 Peanut MQTT 协议，topic=pudu/robot/state
interface KeenonRawMsg {
  cmd: string
  payload: {
    level?: number
    v?: number
    x?: number
    y?: number
    angle?: number
    status?: number
    err?: string
  }
}

// 2026-08-28 输入埋点节流：Peanut mock ~6.7Hz 逐帧打印会刷满 console 缓冲区，
// 淹没 OTA(8s)/工业(5s) 等低频埋点 → 仅每 50 帧采样一次（约 7.5 秒一条）
let peanutFrameCount = 0

export function adaptKeenon(
  raw: KeenonRawMsg,
  robotId: string
): UnifiedRobotState {
  if (++peanutFrameCount % 50 === 1) {
    console.log('[adapter-keenon] 输入:', { cmd: raw.cmd, battery: raw.payload.level, status: raw.payload.status, err: raw.payload.err })
  }
  const state: UnifiedRobotState = {
    robotId,
    brand: 'keenon',
    model: 'peanut',
    batteryPct: raw.payload.level ?? 0,
    voltage: raw.payload.v ?? 0,
    online: true,
    position: {
      x: raw.payload.x ?? 0,
      y: raw.payload.y ?? 0,
      theta: ((raw.payload.angle ?? 0) * Math.PI) / 180,
    },
    status: mapKeenonStatus(raw.payload.status),
    errorCode: raw.payload.err,
    lastSeen: Date.now(),
  }
  // 2026-08-28 输出埋点复用同一采样计数，与输入埋点保持一致的 1/50 频率
  if (peanutFrameCount % 50 === 1) {
    console.log('[adapter-keenon] 输出:', { robotId, battery: state.batteryPct, status: state.status, theta: state.position.theta })
  }
  return state
}

function mapKeenonStatus(s?: number): UnifiedRobotState['status'] {
  switch (s) {
    case 1: return 'idle'
    case 2: return 'moving'
    case 3: return 'working'
    case 4: return 'charging'
    default: return 'error'
  }
}

export function adaptKeenonAlert(raw: KeenonRawMsg, robotId: string): UnifiedAlert | null {
  if (!raw.payload.err) return null
  return {
    robotId,
    level: 'error',
    code: raw.payload.err,
    message: `擎朗告警: ${raw.payload.err}`,
    timestamp: Date.now(),
  }
}
