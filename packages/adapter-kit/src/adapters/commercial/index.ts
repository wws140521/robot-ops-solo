/**
 * 商用机器人适配器聚合
 * 宇树/擎朗/普渡/智元 → UnifiedRobotState
 */
import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified'
import { adaptUnitree, adaptUnitreeAlert } from './adapter-unitree'
import { adaptKeenon, adaptKeenonAlert } from './adapter-keenon'
import { adaptAgibot, adaptAgibotAlert } from './adapter-agibot'
import { adaptPudutech, adaptPudutechAlert } from './adapter-pudutech'

// 2026-08-19 未知品牌降级策略，返回安全 mock 避免运行时崩溃
function fallbackState(brand: string, raw: any, robotId: string): UnifiedRobotState {
  console.warn(`[adapter-kit] 品牌 "${brand}" 未注册，使用 fallback mock state`)
  return {
    robotId,
    brand,
    model: 'unknown',
    batteryPct: raw?.battery ?? raw?.percentage ?? 0,
    voltage: raw?.voltage ?? 0,
    online: true,
    position: { x: 0, y: 0, theta: 0 },
    status: 'idle',
    lastSeen: Date.now(),
  }
}

function fallbackAlert(brand: string, raw: any, robotId: string): UnifiedAlert | null {
  if (raw?.err || raw?.error) {
    console.warn(`[adapter-kit] 品牌 "${brand}" 告警走 fallback`)
    return {
      robotId,
      level: 'warn',
      code: `FALLBACK_${brand.toUpperCase()}`,
      message: `未注册品牌 "${brand}" 的告警: ${raw?.err ?? raw?.error}`,
      timestamp: Date.now(),
    }
  }
  return null
}

// 2026-08-18 品牌工厂分发逻辑，未注册品牌走 fallback 不 throw
export function adaptIncoming(
  brand: string,
  raw: any,
  robotId: string
): UnifiedRobotState {
  switch (brand) {
    case 'unitree':   return adaptUnitree(raw, robotId)
    case 'keenon':    return adaptKeenon(raw, robotId)
    case 'agibot':    return adaptAgibot(raw, robotId)
    case 'pudutech':  return adaptPudutech(raw, robotId)
    default:          return fallbackState(brand, raw, robotId)
  }
}

export function adaptIncomingAlert(
  brand: string,
  raw: any,
  robotId: string
): UnifiedAlert | null {
  switch (brand) {
    case 'unitree':   return adaptUnitreeAlert(raw, robotId)
    case 'keenon':    return adaptKeenonAlert(raw, robotId)
    case 'agibot':    return adaptAgibotAlert(raw, robotId)
    case 'pudutech':  return adaptPudutechAlert(raw, robotId)
    default:          return fallbackAlert(brand, raw, robotId)
  }
}

/**
 * 商用统一分发：返回 state + alerts
 */
export function adaptCommercial(
  brand: string,
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const robotId = raw?.robot_id ?? raw?.robotId ?? `robot-${Date.now()}`
  const state = adaptIncoming(brand, raw, robotId)
  const alert = adaptIncomingAlert(brand, raw, robotId)
  return { state, alerts: alert ? [alert] : [] }
}
