// gaitMath.ts
// G1 人形机器人步态纯数学模块 —— 从 G1Humanoid.tsx 的 useFrame 中抽取，
// 零依赖纯函数，可单测。三个核心不变量：
//
// 1. 步距一致（防太空步）：2×腿长×sin(步幅角) = 步长，视觉迈步距离 = 物理移动距离
// 2. 步频物理一致：一个相位周期左右各迈一步，2×步频×步长 = 速度
// 3. 朝向对齐（防螃蟹步）：G1 URDF 前向 = 局部 +X，Ry(-θ) 恰好把面向对准移动方向

// ─── 通用工具 ─────────────────────────────────────────

export function clamp(v: number, min: number, max: number): number {
  if (!isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

// 角度差归一化到 (-π, π]，转向选最短方向
export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

// ─── 步频：一个周期迈两步（步距一致修复的核心） ────────────────
// 之前用 vel/stepLength，步频快了一倍，脚在地上滑（太空步）。
// strideLen = 2 × stepLength：一个相位周期 = 左右各迈一步。
export function stepFrequency(vel: number, stepLength: number): number {
  const strideLen = 2 * stepLength
  return clamp(vel / strideLen, 0.2, 1.2)
}

// ─── 实际单步步长 → 腿部摆幅缩放系数 ──────────────────────
// 实际步长 = 速度 ÷ (2×步频)；legAmp = 实际步长/目标步长。
// 速度为 0 → legAmp → 0，腿自然收拢，不会原地空踏。
export function actualStepLength(vel: number, freq: number): number {
  return freq > 0.05 ? vel / (2 * freq) : 0
}

export function legAmplitude(actualStepLen: number, targetStepLen: number): number {
  return clamp(actualStepLen / targetStepLen, 0, 1.15)
}

// ─── 物理步幅角（防太空步的核心公式） ──────────────────────
// 髋部摆角 θ 满足 2×LEG_LEN×sin(θ) = 视觉迈步距离，
// 让脚的视觉位移 = 身体物理位移，脚不打滑。
// asin 参数钳到 0.9：步长超过腿长 1.8 倍时物理上迈不出，保底饱和。
export function stridePitchAmplitude(stepLength: number, legLen: number): number {
  return Math.asin(clamp(stepLength / (2 * legLen), 0, 0.9))
}

// ─── 航向连续跟踪（防转向抽搐的核心） ──────────────────────
// 一阶低通跟踪：τ 越小跟随越快。mock 转弯速率 1.5 rad/s、τ=0.18s 时
// 稳态滞后 0.27 rad —— 视觉上是自然的弧线转弯，不再有冻结-瞬移。
export function trackHeading(
  currentTheta: number,
  freshHeading: number,
  dt: number,
  tau: number,
): number {
  const headingError = wrapAngle(freshHeading - currentTheta)
  const alpha = 1 - Math.exp(-dt / tau)
  return wrapAngle(currentTheta + headingError * alpha)
}

// ─── 朝向映射（防螃蟹步的核心） ─────────────────────────────
// G1 是 URDF 模型（ROS 标准），局部前向 = +X，不是 +Z。
// Ry(-θ) 把局部 +X 旋到世界 (cosθ, sinθ) —— 正好对准 mock 约定下的移动方向。
// 曾经错写成 -θ-π/2，机器人永远侧着走（螃蟹步）。
export function thetaToRotY(theta: number): number {
  return -theta
}

// ─── Dead reckoning tick 插值（防位置抖动） ────────────────────
// WS tick 间线性插值：alpha = (tickAge+dt)/tickInterval，饱和到 1 后等最新 tick。
// 用实测间隔而不是硬编码 0.1s，网络抖动也不出锯齿。
export function tickInterpAlpha(tickAge: number, dt: number, tickInterval: number): number {
  return clamp((tickAge + dt) / Math.max(tickInterval, 1e-6), 0, 1)
}

// ─── tick 间隔实测 EMA ─────────────────────────────────────
// measured 是从上一 tick 到本帧的真实耗时（≥0.02s 防除零）。
export function measuredTickInterval(tickAge: number, dt: number): number {
  return Math.max(tickAge + dt, 0.02)
}

export function emaTickInterval(prevEma: number, measured: number): number {
  return prevEma + (measured - prevEma) * 0.25
}

// ─── 速度向量 EMA（防 mock 位置舍入噪声） ────────────────────
// mock 位置四舍五入到 0.01m，逐 tick 差分算航向会 ±8° 振荡；
// 把每 tick 位移 EMA 成速度向量，航向/速度都从它取，噪声自然被滤掉。
export function emaVelocity(
  prevVel: number,
  displacement: number,
  measured: number,
): number {
  const k = 1 - Math.exp(-measured / 0.2)
  return prevVel + (displacement / measured - prevVel) * k
}

// ─── 步态常量（与 G1Humanoid 保持一致） ─────────────────────
export const GAIT_CONSTANTS = {
  STEP_LENGTH: 0.45,       // 单步步长 m
  LEG_LEN: 0.78,           // 髋到脚底腿长 m
  HEADING_TAU: 0.18,       // 航向跟踪时间常数 s
  FREQ_MIN: 0.2,           // 步频下限 Hz
  FREQ_MAX: 1.2,           // 步频上限 Hz
  TURN_THRESHOLD: 0.3,     // 17° → 切交叉步
  ALIGN_THRESHOLD: 0.15,   // 8.6° → 回正常步态
} as const
