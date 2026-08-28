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

// 2026-08-28 出口埋点节流：mock 高频帧电量逐帧微变导致日志内容唯一、无法被 console 去重，
// 逐帧打印会刷满缓冲区淹没低频埋点（OTA 8s/工业 5s/sendCommand）→ 仅在电量整数位或状态变化时打印
const lastAdaptLogSig: Record<string, string> = {}
// 2026-08-28 入口埋点同策略节流（帧计数采样），rawKeys 逐帧相同无追踪价值 → 仅每 50 帧采样一次
const adaptEntryCount: Record<string, number> = {}

// 2026-08-18 品牌工厂分发逻辑，未注册品牌走 fallback 不 throw
export function adaptIncoming(
  brand: string,
  raw: any,
  robotId: string
): UnifiedRobotState {
  // 2026-08-21 埋点：适配器入口，记录品牌+robotId 便于追踪数据流（1/50 采样防刷屏）
  const frameNo = (adaptEntryCount[robotId] ?? 0) + 1
  adaptEntryCount[robotId] = frameNo
  if (frameNo % 50 === 1) {
    console.log('[adapter] adaptIncoming 入口:', { brand, robotId, rawKeys: Object.keys(raw ?? {}) })
  }
  let state: UnifiedRobotState
  switch (brand) {
    case 'unitree':   state = adaptUnitree(raw, robotId); break
    case 'keenon':    state = adaptKeenon(raw, robotId); break
    case 'agibot':    state = adaptAgibot(raw, robotId); break
    case 'pudutech':  state = adaptPudutech(raw, robotId); break
    default:          state = fallbackState(brand, raw, robotId); break
  }
  const sig = `${state.batteryPct | 0}:${state.status}`
  if (lastAdaptLogSig[robotId] !== sig) {
    lastAdaptLogSig[robotId] = sig
    console.log('[adapter] adaptIncoming 出口:', { brand, robotId, battery: state.batteryPct, status: state.status })
  }
  return state
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
  console.log('[adapter] adaptCommercial 聚合入口:', { brand, robotId })
  const state = adaptIncoming(brand, raw, robotId)
  const alert = adaptIncomingAlert(brand, raw, robotId)
  const result = { state, alerts: alert ? [alert] : [] }
  console.log('[adapter] adaptCommercial 聚合出口:', { robotId, stateStatus: state.status, alertCount: result.alerts.length })
  return result
}
