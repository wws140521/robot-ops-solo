import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified'

// 2026-08-18 整理宇树 G1 WS 字段，社区文档+实机抓包交叉验证
interface UnitreeRawMsg {
  topic: string
  data: {
    percentage?: number
    voltage?: number
    position?: { x: number; y: number; yaw: number }
    joints?: Record<string, number>
    error_code?: number
    // /alert 主题载荷
    code?: string
    msg?: string
  }
}

// 2026-08-28 输入埋点节流：G1 mock ~10Hz 高频帧且电压逐帧变化无法被 console 去重，
// 逐帧打印会把 100 条缓冲区刷满，淹没 OTA(8s)/工业(5s) 等低频埋点 → 仅每 50 帧采样一次
let g1FrameCount = 0
// 2026-08-28 轴数异常告警标志（只 warn 一次）
let g1JointWarned = false

export function adaptUnitree(
  raw: UnitreeRawMsg,
  robotId: string
): UnifiedRobotState {
  if (++g1FrameCount % 50 === 1) {
    console.log('[adapter-unitree] 输入:', { topic: raw.topic, battery: raw.data.percentage, voltage: raw.data.voltage, hasJoints: !!raw.data.joints, frame: g1FrameCount })
  }
  const batteryLow = (raw.data.percentage ?? 100) < 10
  // TODO: 多轴联动时 joint 角速度需单独换算，当前只取静态值
  // 2026-08-28 轴数异常 warn 只报一次：mock G1 固定发 29+ 关节（持续性偏差），
  // 逐帧 warn 会以 ~10Hz 刷屏，淹没 OTA(8s)/工业(5s) 等低频埋点
  if (raw.data.joints && Object.keys(raw.data.joints).length < 29) {
    if (!g1JointWarned) {
      g1JointWarned = true
      console.warn('[adapter] 宇树轴数异常:', Object.keys(raw.data.joints).length, '期望 ≥29')
    }
  }

  const state: UnifiedRobotState = {
    robotId,
    brand: 'unitree',
    model: 'g1',
    batteryPct: raw.data.percentage ?? 0,
    voltage: raw.data.voltage ?? 0,
    online: true,
    position: {
      x: raw.data.position?.x ?? 0,
      y: raw.data.position?.y ?? 0,
      theta: raw.data.position?.yaw ?? 0,
    },
    joints: raw.data.joints,
    status: batteryLow ? 'error' : (raw.data.percentage ?? 0) > 80 ? 'idle' : 'moving',
    errorCode: raw.data.error_code ? `U${raw.data.error_code}` : undefined,
    lastSeen: Date.now(),
  }
  // 2026-08-28 输出埋点复用同一采样计数，与输入埋点保持一致的 1/50 频率
  if (g1FrameCount % 50 === 1) {
    console.log('[adapter-unitree] 输出:', { robotId, battery: state.batteryPct, status: state.status, errorCode: state.errorCode })
  }
  return state
}

// 2026-08-19 补充宇树告警双通道映射，修复状态帧内嵌 error_code 漏判
export function adaptUnitreeAlert(raw: UnitreeRawMsg, robotId: string): UnifiedAlert | null {
  console.log('[adapter-unitree] 告警适配入口:', { topic: raw.topic, hasError: !!raw.data?.error_code, code: raw.data?.code })
  // /alert 主题：{ code, msg }
  if (raw.topic === '/alert' && raw.data) {
    const code = raw.data.code ?? 'UNKNOWN'
    return {
      robotId,
      level: code.startsWith('E') ? 'error' : 'warn',
      code,
      message: raw.data.msg ?? '未知告警',
      timestamp: Date.now(),
    }
  }
  // 2026-08-19 状态帧内嵌 error_code 兜底（非 /alert 主题也可能携带错误码）
  if (!raw.data?.error_code) return null
  return {
    robotId,
    level: raw.data.error_code > 100 ? 'error' : 'warn',
    code: `U${raw.data.error_code}`,
    message: ERROR_MAP[raw.data.error_code] ?? '未知错误',
    timestamp: Date.now(),
  }
}

const ERROR_MAP: Record<number, string> = {
  101: '关节过温',
  102: '电池电压异常',
  103: 'IMU 校准失败',
  201: 'WiFi 断开',
  202: '心跳超时',
}
