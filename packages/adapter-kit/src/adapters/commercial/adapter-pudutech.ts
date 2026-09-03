import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified'

// 普渡（PuduTech）adapter —— 现在也是个 stub
// SDK 文档还没到手，字段纯靠猜，先 fallback 别让页面崩
// 接真机的时候再回来对齐协议
export function adaptPudutech(raw: any, robotId: string): UnifiedRobotState {
  const batteryPct = raw?.battery ?? raw?.power ?? 0
  return {
    robotId,
    brand: 'pudutech',
    model: raw?.model ?? 'unknown',
    batteryPct,
    voltage: raw?.voltage ?? 0,
    online: true,
    position: {
      x: raw?.x ?? raw?.position?.x ?? 0,
      y: raw?.y ?? raw?.position?.y ?? 0,
      theta: raw?.theta ?? raw?.position?.theta ?? 0,
    },
    status: mapPudutechStatus(raw?.status),
    errorCode: raw?.error ?? raw?.err,
    lastSeen: Date.now(),
  }
}

// 把普渡的状态码/字符串转成统一状态
// 字符串多几个同义词，比如 standby / dock 都算
function mapPudutechStatus(s?: string | number): UnifiedRobotState['status'] {
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
    if (lower.includes('idle') || lower.includes('standby')) return 'idle'
    if (lower.includes('mov') || lower.includes('walk')) return 'moving'
    if (lower.includes('work') || lower.includes('task')) return 'working'
    if (lower.includes('charg') || lower.includes('dock')) return 'charging'
    if (lower.includes('err') || lower.includes('fail')) return 'error'
  }
  return 'idle'
}

// 普渡告警适配，没 code 也没 msg 就不算告警
export function adaptPudutechAlert(raw: any, robotId: string): UnifiedAlert | null {
  const code = raw?.code ?? raw?.error
  const msg = raw?.msg ?? raw?.message ?? raw?.err
  if (!code && !msg) return null
  return {
    robotId,
    level: raw?.level ?? 'warn',
    code: code ?? 'PUDUTECH_UNKNOWN',
    message: msg ?? '普渡未知告警',
    timestamp: Date.now(),
  }
}
