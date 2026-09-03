import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified'

// 智元（Agibot）adapter —— 现在是个 stub
// 真机 SDK 文档还没拿到，字段都是猜的，先保证不接硬件也能跑
// 后面有文档了再补全协议字段
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

// 把智元的状态码/字符串转成统一状态
// 数字和字符串都兼容，因为不同版本协议混着来
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

// 智元告警适配，没 code 也没 msg 就不算告警
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
