// eVTOL 起降场健康分算法，0-100 分
// 优先级大概是这样：充电坪能不能落 > 消防有没有问题 > 地面电源电压 > 照明
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

// 计算起降场健康分，0-100，越高越健康
// 也是一堆 magic number，先这么用着，后面有数据了再调
export function calcVertiportHealthScore(vertiport: VertiportTelemetry): number {
  const scores: Record<keyof VertiportHealthWeights, number> = {
    // 充电坪：故障 0 分；正在充电 90 分；可用 100 分
    padState: vertiport.chargingPadState === 'fault' ? 0
      : vertiport.chargingPadState === 'charging' ? 90 : 100,
    // 消防：故障 0 分；已释放（用过）50 分；待命 100 分
    fireSuppression: vertiport.fireSuppression === 'fault' ? 0
      : vertiport.fireSuppression === 'discharged' ? 50 : 100,
    // 地面电源：以 400V 为额定值，偏离越多分数越低，每伏特扣 0.5 分
    groundPower: clamp(
      100 - Math.abs(vertiport.groundPowerVoltageV - 400) * 0.5,
      0,
      100,
    ),
    // 照明：常开 100 分；自动 90 分；关闭 70 分（夜间可能不够）
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
