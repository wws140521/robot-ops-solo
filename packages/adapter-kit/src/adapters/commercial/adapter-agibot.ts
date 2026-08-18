import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified'

/**
 * 智元（Agibot）adapter —— stub
 * TODO: 接入真机后补全协议字段（当前仅有字段猜测，不接硬件时安全 fallback）
 * 参考字段（待 SDK 文档确认）：battery, voltage, x, y, theta, status
 */
export function adaptAgibot(raw: any, robotId: string): UnifiedRobotState {
  const batteryPct = raw?.battery ?? raw?.percentage ?? 0
  return {
    robotId,
    brand: 'agibot',
    model: raw?.model ?? 'unknown',
    batteryPct,
    voltage: raw?.voltage ?? 0,
    online: true,
    position: {
      x: raw?.x ?? raw?.position?.x ?? 0,
      y: raw?.y ?? raw?.position?.y ?? 0,
      theta: raw?.theta ?? raw?.position?.theta ?? 0,
    },
    status: mapAgibotStatus(raw?.status),
    errorCode: raw?.error ?? raw?.err,
    lastSeen: Date.now(),
  }
}

function mapAgibotStatus(s?: string | number): UnifiedRobotState['status'] {
  if (typeof s === 'number') {
    switch (s) {
      case 0: return 'idle'
      case 1: return 'moving'
      case 2: return 'working'
      case 3: return 'charging'
      default: return 'error'
    }
  }
  if (typeof s === 'string') {
    const lower = s.toLowerCase()
    if (lower.includes('idle')) return 'idle'
    if (lower.includes('mov')) return 'moving'
    if (lower.includes('work')) return 'working'
    if (lower.includes('charg')) return 'charging'
    if (lower.includes('err') || lower.includes('fail')) return 'error'
  }
  return 'idle'
}

export function adaptAgibotAlert(raw: any, robotId: string): UnifiedAlert | null {
  const code = raw?.code ?? raw?.error
  const msg = raw?.msg ?? raw?.message ?? raw?.err
  if (!code && !msg) return null
  return {
    robotId,
    level: raw?.level ?? 'warn',
    code: code ?? 'AGIBOT_UNKNOWN',
    message: msg ?? '智元未知告警',
    timestamp: Date.now(),
  }
}
