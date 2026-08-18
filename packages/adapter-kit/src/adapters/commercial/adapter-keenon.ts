import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified'

// 擎朗 Peanut 原始消息结构（MQTT topic: pudu/robot/state）
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

export function adaptKeenon(
  raw: KeenonRawMsg,
  robotId: string
): UnifiedRobotState {
  return {
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
