/**
 * eVTOL 起降场地面设施健康分算法
 */
import type { VertiportTelemetry } from '../types/unified'

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

export interface VertiportHealthWeights {
  padState: number
  fireSuppression: number
  groundPower: number
  lighting: number
}

export const VERTIPORT_WEIGHTS: VertiportHealthWeights = {
  padState: 0.35,
  fireSuppression: 0.30,
  groundPower: 0.25,
  lighting: 0.10,
}

/**
 * 计算起降场健康分（0-100，越高越健康）
 */
export function calcVertiportHealthScore(vertiport: VertiportTelemetry): number {
  const scores: Record<keyof VertiportHealthWeights, number> = {
    padState: vertiport.chargingPadState === 'fault' ? 0
      : vertiport.chargingPadState === 'charging' ? 90 : 100,
    fireSuppression: vertiport.fireSuppression === 'fault' ? 0
      : vertiport.fireSuppression === 'discharged' ? 50 : 100,
    groundPower: clamp(
      100 - Math.abs(vertiport.groundPowerVoltageV - 400) * 0.5,
      0,
      100,
    ),
    lighting: vertiport.lighting === 'on' ? 100
      : vertiport.lighting === 'auto' ? 90 : 70,
  }

  const w = VERTIPORT_WEIGHTS
  return Math.round(
    scores.padState * w.padState
    + scores.fireSuppression * w.fireSuppression
    + scores.groundPower * w.groundPower
    + scores.lighting * w.lighting,
  )
}
