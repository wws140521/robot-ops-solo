// 统一机器人状态模型 —— 所有品牌转成这个结构
import type { IndustrialExtension } from './industrial'

export interface UnifiedRobotState {
  robotId: string
  brand: string
  model: string
  batteryPct: number
  voltage: number
  online: boolean
  position: { x: number; y: number; theta: number }
  joints?: Record<string, number>
  status: 'idle' | 'moving' | 'working' | 'error' | 'charging'
  errorCode?: string
  lastSeen: number
  /**
   * 工业扩展字段
   * - 商用机器人（宇树/擎朗/普渡/智元）不传此字段
   * - 工业机器人（FANUC/KUKA/埃斯顿/安川）必传
   */
  industrial?: IndustrialExtension
}

// 统一告警
export interface UnifiedAlert {
  robotId: string
  level: 'info' | 'warn' | 'error'
  code: string
  message: string
  timestamp: number
}

// 统一任务指令（下发用）
export interface UnifiedCommand {
  robotId: string
  action: 'move' | 'speak' | 'dock' | 'stop' | 'custom'
  payload: Record<string, any>
}
