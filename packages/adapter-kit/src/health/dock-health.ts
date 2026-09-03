/**
 * 机巢健康分算法
 * 复用加权框架，结果归一化到 0-100
 */
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

/**
 * 计算机巢健康分（0-100，越高越健康）
 */
export function calcDockHealthScore(
  dock: DockTelemetry,
  uav: UAVTelemetry | undefined,
): number {
  const scores: Record<keyof DockHealthWeights, number> = {
    // 充电器温度：>60℃ 为 0，<40℃ 为 100
    chargerTemp: clamp(100 - Math.max(0, dock.chargerTempC - 40) * 5, 0, 100),
    // 舱门：jammed=0, open=80, closed=100
    doorState: dock.doorState === 'jammed' ? 0
      : dock.doorState === 'open' ? 80 : 100,
    // 电池健康：循环次数（>100 衰减）+ 当前电量
    batteryHealth: uav
      ? clamp(100 - Math.max(0, uav.batteryCycles - 100) * 0.5, 0, 100) * 0.6
        + uav.batteryPct * 0.4
      : 100,
    // 信号：RSSI -90=0, -50=100
    signal: uav ? clamp((uav.signalRssi + 90) * 2.5, 0, 100) : 100,
    // 气象：风速>8m/s 开始衰减
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
