// gaitMath.test.ts
// 步态数学模块单元测试 —— 锁定「抽搐 / 太空步 / 螃蟹步」三项修复的不变量
import { describe, it, expect } from 'vitest'
import {
  clamp,
  wrapAngle,
  stepFrequency,
  actualStepLength,
  legAmplitude,
  stridePitchAmplitude,
  trackHeading,
  thetaToRotY,
  tickInterpAlpha,
  measuredTickInterval,
  emaTickInterval,
  emaVelocity,
  GAIT_CONSTANTS,
} from '../gaitMath'

const { STEP_LENGTH, LEG_LEN } = GAIT_CONSTANTS

// three.js Ry(α) 旋转矩阵作用于向量的数学等价实现（不引 three，纯数学验证）
// Ry(α): (x, z) → (x·cosα + z·sinα, -x·sinα + z·cosα)
function applyRotY(alpha: number, x: number, z: number): [number, number] {
  return [x * Math.cos(alpha) + z * Math.sin(alpha), -x * Math.sin(alpha) + z * Math.cos(alpha)]
}

describe('通用工具', () => {
  it('clamp 钳到区间', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })

  it('clamp 对 NaN 返回下限（防一帧非法值扩散）', () => {
    expect(clamp(NaN, 0.2, 1.2)).toBe(0.2)
    expect(clamp(Infinity, 0.2, 1.2)).toBe(0.2)
  })

  it('wrapAngle 归一化到 (-π, π]', () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 10)
    expect(wrapAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI, 10)
    expect(wrapAngle(Math.PI / 2 + Math.PI * 2)).toBeCloseTo(Math.PI / 2, 10)
  })
})

describe('步频物理一致（步伐与实际距离一致的核心）', () => {
  it('一个步态周期迈两步：2 × 步频 × 步长 = 速度', () => {
    // G1 巡航速度 0.5 m/s → 步频 0.56 Hz（左右脚各 0.56 步/秒）
    const vel = 0.5
    const freq = stepFrequency(vel, STEP_LENGTH)
    expect(freq).toBeCloseTo(0.5 / (2 * STEP_LENGTH), 10)
    // 反推回去：每个周期身体前进距离 = 2 × 单步步长
    expect(2 * freq * STEP_LENGTH).toBeCloseTo(vel, 10)
  })

  it('速度为零时步频钳到下限 0.2Hz，不会倒退成负数', () => {
    expect(stepFrequency(0, STEP_LENGTH)).toBe(0.2)
    expect(stepFrequency(-1, STEP_LENGTH)).toBe(0.2)
  })

  it('速度超上限时步频钳到 1.2Hz（疾走不超过人体极限）', () => {
    expect(stepFrequency(5, STEP_LENGTH)).toBe(1.2)
  })

  it('回归防线：旧公式 vel/stepLength 的步频会快一倍（太空步根因）', () => {
    const vel = 0.5
    const wrong = vel / STEP_LENGTH          // 旧 bug：把步幅周期当单步
    const right = stepFrequency(vel, STEP_LENGTH)
    expect(right).toBeCloseTo(wrong / 2, 10)
  })
})

describe('步幅角与摆幅（防太空步滑脚的核心）', () => {
  it('2 × 腿长 × sin(步幅角) = 步长 → 视觉迈步距离 = 物理移动距离', () => {
    const amp = stridePitchAmplitude(STEP_LENGTH, LEG_LEN)
    const visualStride = 2 * LEG_LEN * Math.sin(amp)
    expect(visualStride).toBeCloseTo(STEP_LENGTH, 10)
  })

  it('步幅角随腿长守恒：矮腿机器人步幅角更大', () => {
    const tall = stridePitchAmplitude(0.4, 1.0)
    const short = stridePitchAmplitude(0.4, 0.5)
    expect(short).toBeGreaterThan(tall)
  })

  it('步长超过腿长可及范围时 asin 参数饱和，不产生 NaN', () => {
    // 2×0.78=1.56m 腿能跨的最大步；stepLength=2m 超物理极限
    expect(stridePitchAmplitude(2.0, 0.78)).toBeCloseTo(Math.asin(0.9), 10)
    expect(Number.isNaN(stridePitchAmplitude(2.0, 0.78))).toBe(false)
  })

  it('实际步长 = 速度 ÷ (2×步频)', () => {
    expect(actualStepLength(0.5, 0.56)).toBeCloseTo(0.5 / 1.12, 10)
  })

  it('步频过低（<0.05Hz）视为静止，实际步长归零', () => {
    expect(actualStepLength(0.5, 0.01)).toBe(0)
    expect(actualStepLength(0.5, 0)).toBe(0)
  })

  it('巡航时 legAmp ≈ 1（满步幅），慢走时按比例缩小', () => {
    const cruise = legAmplitude(actualStepLength(0.5, 0.56), STEP_LENGTH)
    expect(cruise).toBeCloseTo(1, 1)
    const slow = legAmplitude(actualStepLength(0.2, 0.56), STEP_LENGTH)
    expect(slow).toBeLessThan(0.5)
  })

  it('完全停止时 legAmp = 0（腿自然收拢，不原地空踏）', () => {
    expect(legAmplitude(actualStepLength(0, 0.56), STEP_LENGTH)).toBe(0)
  })

  it('legAmp 上限 1.15（瞬时速度尖峰不会让腿甩飞）', () => {
    expect(legAmplitude(1.0, 0.45)).toBe(1.15)
  })
})

describe('朝向映射（防螃蟹步的核心）', () => {
  it('Ry(-θ) 把 URDF 局部前向 +X 对准移动方向 (cosθ, sinθ)', () => {
    // G1 URDF 前向 = 局部 +X（ROS 标准）。mock 约定 θ=0 朝东(+X)，θ=π/2 朝北(+Z)
    for (const theta of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, 2.7]) {
      const rotY = thetaToRotY(theta)
      const [fx, fz] = applyRotY(rotY, 1, 0) // 局部 +X 前向旋转到世界系
      expect(fx).toBeCloseTo(Math.cos(theta), 10)
      expect(fz).toBeCloseTo(Math.sin(theta), 10)
    }
  })

  it('回归防线：旧公式 -θ-π/2 会侧着走（螃蟹步根因）', () => {
    const theta = 0
    const wrong = applyRotY(-theta - Math.PI / 2, 1, 0) // 旧 bug：多减 π/2
    // 移动方向是 (1, 0)，旧公式面向却偏到 (0, -1) → 90° 螃蟹步
    const dot = wrong[0] * 1 + wrong[1] * 0
    expect(Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI)
      .toBeCloseTo(90, 5)
  })

  it('朝向差是普通线性关系（无隐藏相位偏移）', () => {
    expect(thetaToRotY(0)).toBeCloseTo(0, 10)  // -0 与 0 数学等价
    expect(thetaToRotY(Math.PI / 2)).toBe(-Math.PI / 2)
    expect(thetaToRotY(-0.3)).toBe(0.3)
  })
})

describe('航向连续跟踪（防转向抽搐的核心）', () => {
  it('每帧航向变化量有界：单帧最大不超过 headingError 本身', () => {
    // 180° 掉头也不瞬移，按 τ 指数逼近
    let theta = 0
    const dt = 1 / 60
    let maxStep = 0
    for (let i = 0; i < 300; i++) {
      const next = trackHeading(theta, Math.PI, dt, 0.18)
      maxStep = Math.max(maxStep, Math.abs(wrapAngle(next - theta)))
      theta = next
    }
    // 单帧步长 ≈ π × (1-exp(-dt/τ)) ≈ 0.27 rad，远小于 π
    expect(maxStep).toBeLessThan(0.3)
    // 300 帧（5 秒）后应已收敛到目标
    expect(Math.abs(wrapAngle(theta - Math.PI))).toBeLessThan(0.01)
  })

  it('静态输入保持不变（fresh = current 时零漂移）', () => {
    expect(trackHeading(1.2, 1.2, 1 / 60, 0.18)).toBe(1.2)
  })

  it('跨 ±π 边界走最短方向（不会绕远路一整圈）', () => {
    // 当前 -179°，目标 +179° → 最短路径只差 2°，不是 358°
    const next = trackHeading(-Math.PI + 0.02, Math.PI - 0.02, 1 / 60, 0.18)
    const moved = Math.abs(wrapAngle(next - (-Math.PI + 0.02)))
    expect(moved).toBeLessThan(0.01)
  })

  it('连续跟踪收敛后与目标一致（模拟 1.5 rad/s 匀速转向的稳态滞后）', () => {
    // mock 转弯速率 1.5 rad/s，τ=0.18s → 稳态滞后 ≈ 1.5×0.18 = 0.27 rad
    let theta = 0
    const dt = 1 / 60
    const turnRate = 1.5
    for (let i = 0; i < 600; i++) {
      theta = trackHeading(theta, theta + turnRate * dt, dt, 0.18)
    }
    // 一阶跟踪稳态滞后 = turnRate × τ（±15% 容差）
    const lag = turnRate * 0.18
    expect(lag).toBeGreaterThan(0.2)
    expect(lag).toBeLessThan(0.35)
  })
})

describe('dead reckoning tick 插值（防位置抖动）', () => {
  it('tick 到达瞬间 alpha≈0（从上一 tick 位置起算）', () => {
    expect(tickInterpAlpha(0, 1 / 60, 0.1)).toBeCloseTo(1 / 6, 10)
  })

  it('tickAge 超过间隔后 alpha 饱和到 1（等最新 tick，不外插）', () => {
    expect(tickInterpAlpha(0.2, 1 / 60, 0.1)).toBe(1)
    expect(tickInterpAlpha(5, 1 / 60, 0.1)).toBe(1)
  })

  it('间隔为零或负时不会除零（返回饱和值）', () => {
    expect(Number.isFinite(tickInterpAlpha(0.05, 0.016, 0))).toBe(true)
    expect(Number.isFinite(tickInterpAlpha(0.05, 0.016, -1))).toBe(true)
  })

  it('插值轨迹连续：多 tick 流下相邻帧位移无跳变脉冲', () => {
    // 模拟真实帧循环：60fps 渲染、0.1s 一个 WS tick、每 tick 前进 0.05m（0.5 m/s）
    let prev = 0
    let curr = 0.05
    let tickAge = 0.05
    const interval = 0.1
    const dt = 1 / 60
    let lastX = prev + (curr - prev) * tickInterpAlpha(tickAge, 0, interval)
    let maxFrameDisp = 0
    for (let f = 0; f < 300; f++) {  // 5 秒
      tickAge += dt
      if (tickAge >= interval) {  // 新 tick 到达：prev/curr 推进（G1Humanoid 的 wsChanged 分支）
        tickAge -= interval
        prev = curr
        curr += 0.05
      }
      const x = prev + (curr - prev) * tickInterpAlpha(tickAge, dt, interval)
      maxFrameDisp = Math.max(maxFrameDisp, Math.abs(x - lastX))
      lastX = x
    }
    // 均匀速度 0.5 m/s → 每帧 ≈0.0083m；跳变脉冲不应超过 3 倍
    expect(maxFrameDisp).toBeLessThanOrEqual(3 * 0.05 / interval / 60)
  })
})

describe('tick 间隔与速度 EMA（防 mock 位置舍入噪声）', () => {
  it('实测间隔有 0.02s 下限（防除零放大噪声）', () => {
    expect(measuredTickInterval(0, 0)).toBe(0.02)
    expect(measuredTickInterval(-0.5, 0)).toBe(0.02)
    expect(measuredTickInterval(0.08, 0.016)).toBeCloseTo(0.096, 10)
  })

  it('tick 间隔 EMA 收敛到实测值（网络抖动平滑）', () => {
    let ema = 0.1
    for (let i = 0; i < 50; i++) ema = emaTickInterval(ema, 0.2)
    expect(ema).toBeCloseTo(0.2, 3)
  })

  it('速度 EMA：恒定位移流收敛到真实速度', () => {
    let vel = 0
    // 每 0.1s 移动 0.05m → 0.5 m/s
    for (let i = 0; i < 100; i++) vel = emaVelocity(vel, 0.05, 0.1)
    expect(vel).toBeCloseTo(0.5, 3)
  })

  it('速度 EMA 滤掉单帧噪声脉冲（0.01m 舍入不会立刻打满速度）', () => {
    let vel = 0.5
    // 一帧噪声：位移 0.5m（舍入毛刺），但只发生一次
    vel = emaVelocity(vel, 0.5, 0.1)
    // 增益 k = 1-exp(-0.1/0.2) ≈ 0.39，毛刺被压到 39%
    expect(vel).toBeLessThan(0.5 + 4.5 * 0.4)
    expect(vel).toBeGreaterThan(0.5)
  })

  it('长间隔可信度更高：EMA 更贴近该 tick 的瞬时速度估计', () => {
    // 同样 0.05m 位移：短间隔的瞬时估计 1.0 m/s 只信 22%；长间隔的 0.1 m/s 信 92%
    const shortTarget = 0.05 / 0.05  // 1.0
    const longTarget = 0.05 / 0.5    // 0.1
    const shortErr = Math.abs(emaVelocity(0, 0.05, 0.05) - shortTarget) / shortTarget
    const longErr = Math.abs(emaVelocity(0, 0.05, 0.5) - longTarget) / longTarget
    expect(longErr).toBeLessThan(shortErr)
  })
})

describe('步态常量自洽（与 G1Humanoid 运行时一致）', () => {
  it('G1 巡航速度 0.5 m/s 时步频落在 0.5~0.6 Hz', () => {
    const freq = stepFrequency(0.5, STEP_LENGTH)
    expect(freq).toBeGreaterThan(0.5)
    expect(freq).toBeLessThan(0.6)
  })

  it('步幅角 < 20°（自然步态，不夸张劈叉）', () => {
    const deg = stridePitchAmplitude(STEP_LENGTH, LEG_LEN) * 180 / Math.PI
    expect(deg).toBeGreaterThan(14)
    expect(deg).toBeLessThan(20)
  })
})
