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

export function adaptKeenon(
  raw: KeenonRawMsg,
  robotId: string
): UnifiedRobotState {
  console.log('[adapter-keenon] 输入:', { cmd: raw.cmd, battery: raw.payload.level, status: raw.payload.status, err: raw.payload.err })
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
  console.log('[adapter-keenon] 输出:', { robotId, battery: state.batteryPct, status: state.status, theta: state.position.theta })
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
