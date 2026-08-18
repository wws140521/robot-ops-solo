import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified'

// 宇树 G1 原始 WS 消息结构（社区已扒字段）
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

export function adaptUnitree(
  raw: UnitreeRawMsg,
  robotId: string
): UnifiedRobotState {
  const batteryLow = (raw.data.percentage ?? 100) < 10

  return {
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
}

// 宇树告警映射：支持 /alert 主题帧 + 状态帧内嵌 error_code
export function adaptUnitreeAlert(raw: UnitreeRawMsg, robotId: string): UnifiedAlert | null {
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
  // 状态帧内嵌的 error_code
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
