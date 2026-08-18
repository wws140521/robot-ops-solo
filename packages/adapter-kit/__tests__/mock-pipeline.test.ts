import { describe, it, expect } from 'vitest'
import { adaptIncoming, adaptIncomingAlert } from '../src/adapters'

// ────────────────────────────────────────────────────────────
// mock 数据帧：与 mock-ws-server.js 输出格式完全一致
// ────────────────────────────────────────────────────────────

// 宇树 G1 矩形路径上的一个 /state 帧（g1-001 在 (1.5, 0) 段，电量 75%）
const unitreeStateFrame = {
  topic: '/state',
  data: {
    percentage: 75,
    voltage: 53.5,
    position: { x: 1.5, y: 0, yaw: 0 },
    joints: { hip_l: 0.1, hip_r: -0.1, knee_l: 0.2, knee_r: 0.2 },
  },
}

// 宇树电量 20% 阈值告警帧
const unitreeWarnAlertFrame = {
  topic: '/alert',
  data: { code: 'W_BATTERY_LOW', msg: '电量低于20%，建议回充' },
}

// 宇树电量 10% 严重告警帧
const unitreeErrorAlertFrame = {
  topic: '/alert',
  data: { code: 'E_BATTERY_CRITICAL', msg: '电量极低，已停止运动' },
}

// 擎朗 Peanut 直线段 state 帧（peanut-001 在 x=2.5，朝向 180°，移动中）
const keenonStateFrame = {
  cmd: 'state',
  payload: { level: 80, v: 36.0, x: 2.5, y: 1.5, angle: 180, status: 2 },
}

// ────────────────────────────────────────────────────────────
// 测试用例
// ────────────────────────────────────────────────────────────

describe('mock WS 管线 · unitree /state → 统一状态', () => {
  it('矩形路径状态帧被正确归一化', () => {
    const state = adaptIncoming('unitree', unitreeStateFrame, 'g1-001')
    expect(state.robotId).toBe('g1-001')
    expect(state.brand).toBe('unitree')
    expect(state.model).toBe('g1')
    expect(state.batteryPct).toBe(75)
    expect(state.voltage).toBe(53.5)
    expect(state.position).toEqual({ x: 1.5, y: 0, theta: 0 })
    expect(state.joints?.hip_l).toBe(0.1)
    expect(state.online).toBe(true)
    // 75%：不 >80 且不 <10 → moving
    expect(state.status).toBe('moving')
  })

  it('电量 >80 视为 idle', () => {
    const state = adaptIncoming('unitree', { topic: '/state', data: { percentage: 85, voltage: 54 } }, 'g1-001')
    expect(state.status).toBe('idle')
  })

  it('电量 <10 视为 error', () => {
    const state = adaptIncoming('unitree', { topic: '/state', data: { percentage: 5, voltage: 48 } }, 'g1-001')
    expect(state.status).toBe('error')
  })
})

describe('mock WS 管线 · unitree /alert → 告警', () => {
  it('W_BATTERY_LOW 解析为 warn 级告警', () => {
    const alert = adaptIncomingAlert('unitree', unitreeWarnAlertFrame, 'g1-001')
    expect(alert).not.toBeNull()
    expect(alert!.level).toBe('warn')
    expect(alert!.code).toBe('W_BATTERY_LOW')
    expect(alert!.message).toContain('回充')
  })

  it('E_BATTERY_CRITICAL 解析为 error 级告警', () => {
    const alert = adaptIncomingAlert('unitree', unitreeErrorAlertFrame, 'g1-001')
    expect(alert).not.toBeNull()
    expect(alert!.level).toBe('error')
    expect(alert!.code).toBe('E_BATTERY_CRITICAL')
  })

  it('状态帧（无 error_code）不会产生告警', () => {
    const alert = adaptIncomingAlert('unitree', unitreeStateFrame, 'g1-001')
    expect(alert).toBeNull()
  })
})

describe('mock WS 管线 · 告警帧不得污染状态（wsHub 按 topic 分流的依据）', () => {
  it('/alert 帧若误走 adaptIncoming 会得到 0 电量假状态', () => {
    // 这正是 wsHub.isAlertMessage 必须存在的原因：
    // 告警帧没有 percentage，误走状态 adapter 会把电量覆盖成 0，
    // 却因 batteryLow 判定的默认值仍显示 moving —— 明显的脏状态
    const misrouted = adaptIncoming('unitree', unitreeErrorAlertFrame, 'g1-001')
    expect(misrouted.batteryPct).toBe(0)
    expect(misrouted.status).toBe('moving') // 0% 却 moving，明显脏数据
  })

  it('/alert 帧走 adaptIncomingAlert 得到正确告警而非状态', () => {
    const alert = adaptIncomingAlert('unitree', unitreeErrorAlertFrame, 'g1-001')
    expect(alert?.level).toBe('error')
  })
})

describe('mock WS 管线 · keenon state → 统一状态', () => {
  it('angle(度) → theta(弧度) 转换 + status 映射', () => {
    const state = adaptIncoming('keenon', keenonStateFrame, 'peanut-001')
    expect(state.robotId).toBe('peanut-001')
    expect(state.brand).toBe('keenon')
    expect(state.model).toBe('peanut')
    expect(state.batteryPct).toBe(80)
    expect(state.voltage).toBe(36.0)
    expect(state.position.x).toBe(2.5)
    expect(state.position.y).toBe(1.5)
    // 180° → π
    expect(state.position.theta).toBeCloseTo(Math.PI)
    // status 2 → moving
    expect(state.status).toBe('moving')
  })

  it('status 4 → charging', () => {
    const state = adaptIncoming('keenon', {
      cmd: 'state',
      payload: { level: 50, v: 36, x: 0, y: 0, angle: 0, status: 4 },
    }, 'p')
    expect(state.status).toBe('charging')
  })

  it('未提供 status → error（防御默认）', () => {
    const state = adaptIncoming('keenon', {
      cmd: 'state',
      payload: { level: 50, v: 36, x: 0, y: 0, angle: 0 },
    }, 'p')
    expect(state.status).toBe('error')
  })
})

describe('mock WS 管线 · 端到端模拟一轮电量递减 + 告警触发', () => {
  it('从 85% 递减到 20% 触发 warn，递减到 10% 触发 error', () => {
    let battery = 85
    const events: string[] = []
    let lastAlertLevel = 100

    // 模拟 mock-ws-server.js 的递减节奏（每 tick -0.05，每 20 tick = -1%）
    for (let i = 0; i < 1600; i++) { // 1600 tick ≈ 80% 衰减
      battery = Math.max(0, battery - 0.05)

      if (battery <= 20 && lastAlertLevel > 20) {
        const alert = adaptIncomingAlert('unitree', {
          topic: '/alert', data: { code: 'W_BATTERY_LOW', msg: '电量低于20%' },
        }, 'g1-001')
        events.push(`${alert!.level}:${alert!.code}`)
        lastAlertLevel = 20
      }
      if (battery <= 10 && lastAlertLevel > 10) {
        const alert = adaptIncomingAlert('unitree', {
          topic: '/alert', data: { code: 'E_BATTERY_CRITICAL', msg: '电量极低' },
        }, 'g1-001')
        events.push(`${alert!.level}:${alert!.code}`)
        lastAlertLevel = 10
      }
    }

    expect(events).toEqual(['warn:W_BATTERY_LOW', 'error:E_BATTERY_CRITICAL'])
  })
})
