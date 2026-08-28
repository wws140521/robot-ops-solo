// 机器人状态存储层 —— WS 收到消息后写入 Supabase，支持历史轨迹回放
// 对应 SUPABASE.md 第五节 5.2
import { supabase, isSupabaseEnabled, getCurrentTenantSlug } from './supabase'
import type { UnifiedRobotState } from 'robot-adapter-kit'

// 2026-08-28 未登录跳过提示只打一次：写入跳过是持续性状态（未登录/会话过期），
// 逐帧提示会刷满 console 缓冲区淹没低频埋点（OTA 8s/工业 5s/sendCommand）
let skippedWriteWarned = false

// 写入实时状态（WS 收到消息后调用）
export async function writeRobotState(state: UnifiedRobotState, rawMsg?: unknown) {
  if (!isSupabaseEnabled) return // 离线模式不写库

  const tenantSlug = await getCurrentTenantSlug()
  if (!tenantSlug) {
    if (!skippedWriteWarned) {
      skippedWriteWarned = true
      console.warn('[writeRobotState] 未登录，跳过 Supabase 写入（登录后自动恢复）')
    }
    return
  }

  const { error } = await supabase!.from('robot_states').insert({
    robot_id: state.robotId,
    tenant_slug: tenantSlug,
    battery_pct: state.batteryPct,
    voltage: state.voltage,
    online: state.online,
    position: state.position,
    joints: state.joints ?? null,
    status: state.status,
    error_code: state.errorCode ?? null,
    raw_msg: rawMsg ?? null,
  })

  if (error) console.error('[writeRobotState]', error)

  // 同时更新 robots 表的最新状态（upsert 按 tenant_slug+robot_id 唯一约束）
  await supabase!
    .from('robots')
    .upsert(
      {
        robot_id: state.robotId,
        brand: state.brand,
        model: state.model,
        tenant_slug: tenantSlug,
        status: state.status,
        battery_pct: state.batteryPct,
        location: state.position,
      },
      { onConflict: 'tenant_slug,robot_id' }
    )
}

// 读取历史轨迹（用于 3D 大屏回放）
export async function getRobotTrajectory(
  robotId: string,
  fromTime: number,
  toTime: number
) {
  if (!isSupabaseEnabled) return []

  const { data, error } = await supabase!
    .from('robot_states')
    .select('position, created_at')
    .eq('robot_id', robotId)
    .gte('created_at', new Date(fromTime).toISOString())
    .lte('created_at', new Date(toTime).toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    console.error(error)
    return []
  }
  return data ?? []
}

// 列出当前租户所有机器人（初始化 robotStore 时用）
export async function listRobots() {
  if (!isSupabaseEnabled) return []

  const { data, error } = await supabase!
    .from('robots')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    return []
  }
  return data ?? []
}
