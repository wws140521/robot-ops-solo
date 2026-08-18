// Supabase Realtime 订阅 —— 数据库变更实时推到前端，替代部分 WS Hub 功能
// 对应 SUPABASE.md 第六节
// 修正：robot_states 表无 brand/model 字段，订阅时从 store 现有值保留，避免覆盖成 unknown
import { supabase, isSupabaseEnabled } from './supabase'
import { useRobotStore } from '../stores/robotStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

// 订阅单台机器人的实时状态（robot_states 表 INSERT 事件）
export function subscribeRobotStates(robotId: string): RealtimeChannel | null {
  if (!isSupabaseEnabled) return null

  return supabase!
    .channel(`robot:${robotId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'robot_states',
        filter: `robot_id=eq.${robotId}`,
      },
      (payload) => {
        const row = payload.new as {
          battery_pct?: number
          voltage?: number
          online?: boolean
          position?: { x: number; y: number; theta: number }
          joints?: Record<string, number>
          status?: string
          error_code?: string
          created_at?: string
        }
        // brand/model 从 store 现有值取，没有才用 'unknown'（robot_states 表无此字段）
        const existing = useRobotStore.getState().robots[robotId]
        useRobotStore.getState().updateRobot(robotId, {
          robotId,
          brand: existing?.brand ?? 'unknown',
          model: existing?.model ?? 'unknown',
          batteryPct: row.battery_pct ?? 0,
          voltage: row.voltage ?? 0,
          online: row.online ?? true,
          position: row.position ?? { x: 0, y: 0, theta: 0 },
          joints: row.joints ?? undefined,
          status: (row.status as 'idle' | 'moving' | 'working' | 'error' | 'charging') ?? 'idle',
          errorCode: row.error_code ?? undefined,
          lastSeen: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        })
      }
    )
    .subscribe()
}

// 订阅全租户新告警（alerts 表 INSERT 事件）
export function subscribeAlerts(onNewAlert: (alert: unknown) => void): RealtimeChannel | null {
  if (!isSupabaseEnabled) return null

  return supabase!
    .channel('alerts:new')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
      },
      (payload) => {
        onNewAlert(payload.new)
      }
    )
    .subscribe()
}
