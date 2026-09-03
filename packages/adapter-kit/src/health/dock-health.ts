// 机巢健康分算法，0-100 分，越高越健康
// 权重是按现场运维经验拍的：充电器温度最重要，过温容易起火；电池和舱门次之；信号气象凑合看
import type { DockTelemetry, UAVTelemetry } from '../types/unified'

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

export interface DockHealthWeights {
  chargerTemp: number
  doorState: number
  batteryHealth: number
  signal: number
  weather: number
}

export const DOCK_WEIGHTS: DockHealthWeights = {
  chargerTemp: 0.30,
  doorState: 0.20,
  batteryHealth: 0.25,
  signal: 0.10,
  weather: 0.15,
}

// 计算机巢健康分，0-100，越高越健康
// 这里 magic number 一堆，都是凭经验调的，别乱改
export function calcDockHealthScore(
  dock: DockTelemetry,
  uav: UAVTelemetry | undefined,
): number {
  const scores: Record<keyof DockHealthWeights, number> = {
    // 充电器温度：40℃ 以下满分，每超 1℃ 扣 5 分，60℃ 及以上 0 分
    chargerTemp: clamp(100 - Math.max(0, dock.chargerTempC - 40) * 5, 0, 100),
    // 舱门：卡死直接 0 分；打开状态给 80 分（允许临时开舱）
    doorState: dock.doorState === 'jammed' ? 0
      : dock.doorState === 'open' ? 80 : 100,
    // 电池健康：循环次数超过 100 后开始衰减，当前电量占 4 成权重
    batteryHealth: uav
      ? clamp(100 - Math.max(0, uav.batteryCycles - 100) * 0.5, 0, 100) * 0.6
        + uav.batteryPct * 0.4
      : 100,
    // 图传信号：-90dBm 0 分，-50dBm 100 分，线性插值
    signal: uav ? clamp((uav.signalRssi + 90) * 2.5, 0, 100) : 100,
    // 气象：风速 8m/s 以下满分，之后每增加 1m/s 扣 12 分
    weather: clamp(100 - Math.max(0, dock.weather.windSpeedMps - 8) * 12, 0, 100),
  }

  const w = DOCK_WEIGHTS
  return Math.round(
    scores.chargerTemp * w.chargerTemp
    + scores.doorState * w.doorState
    + scores.batteryHealth * w.batteryHealth
    + scores.signal * w.signal
    + scores.weather * w.weather,
  )
}
