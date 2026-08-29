// 2026-08-18 设计 UDM 统一模型，解决多品牌字段不一致问题（FOCAS/OPC UA/Modbus 互不通）
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
  /**
   * 2026-08-29 室外模式扩展
   * - mode: 'indoor' 时 position.x/y 是米（相对原点）
   * - mode: 'outdoor' 时 position.x=经度, position.y=纬度 (GCJ-02)
   */
  mode?: 'indoor' | 'outdoor'
  /** GPS/WGS-84 → GCJ-02 纠偏后的经纬度（室外模式必传） */
  gps?: {
    lng: number
    lat: number
    alt?: number
    accuracy?: number
    coordsys: 'gcj02'
  }
}

// 2026-08-18 统一告警模型，所有品牌告警码翻译为 info/warn/error 三级
export interface UnifiedAlert {
  robotId: string
  level: 'info' | 'warn' | 'error'
  code: string
  message: string
  timestamp: number
}

// 2026-08-18 统一任务指令模型，商用机器人下发用（工业只读）
export interface UnifiedCommand {
  robotId: string
  action: 'move' | 'speak' | 'dock' | 'stop' | 'custom'
  payload: Record<string, any>
}
