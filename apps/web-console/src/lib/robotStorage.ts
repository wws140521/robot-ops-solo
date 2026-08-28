// 机器人状态存储层 —— WS 收到消息后写入 Supabase，支持历史轨迹回放
// 对应 SUPABASE.md 第五节 5.2
import { supabase, isSupabaseEnabled, getCurrentTenantSlug } from './supabase'
import type { UnifiedRobotState } from 'robot-adapter-kit'

// ─── 写入节流：每台机器人每 5 秒才写一次，减少 95%+ 数据库写入 ────────
// 之前每条 WS 消息（~20/秒）都 INSERT 一行 → 1 小时 700MB
// 现在 5 秒一次 → 1 小时仅 360KB，30 天 ≈ 26MB，数据精度仍满足历史轨迹回放需求
const writeThrottle = new Map<string, { lastWriteAt: number; state: UnifiedRobotState }>()
const WRITE_INTERVAL_MS = 5_000 // 5 秒

// 同时写入 robots 表的最新状态（仅记录一次，不在节流范围内）
const robotsUpsertThrottle = new Map<string, number>()
const ROBOTS_UPSERT_INTERVAL_MS = 30_000 // 30 秒

// 未登录跳过提示只打一次
let skippedWriteWarned = false

/**
 * 写入实时状态 —— 带 5 秒节流
 * 数据已大幅瘦身：移除 raw_msg（原始 WS 消息，调试用，体积大）
 *                移除 joints（关节数据，实时 3D 渲染用，历史轨迹不需要）
 */
export async function writeRobotState(state: UnifiedRobotState, _rawMsg?: unknown) {
  if (!isSupabaseEnabled) return

  const tenantSlug = await getCurrentTenantSlug()
  if (!tenantSlug) {
    if (!skippedWriteWarned) {
      skippedWriteWarned = true
      console.warn('[writeRobotState] 未登录，跳过 Supabase 写入（登录后自动恢复）')
    }
    return
  }

  const now = Date.now()
  const robotId = state.robotId

  // ─── robot_states 表：5 秒节流 ──────────────────────────────────────
  const throttleKey = `${robotId}|${tenantSlug}`
  const prev = writeThrottle.get(throttleKey)
  if (prev && now - prev.lastWriteAt < WRITE_INTERVAL_MS) {
    // 仍在节流窗口内，更新缓存但不写库
    prev.state = state
    return
  }

  // 写入瘦身后的状态（移除 raw_msg 和 joints）
  writeThrottle.set(throttleKey, { lastWriteAt: now, state })

  const { error } = await supabase!.from('robot_states').insert({
    robot_id: state.robotId,
    tenant_slug: tenantSlug,
    battery_pct: state.batteryPct,
    voltage: state.voltage,
    online: state.online,
    position: state.position,
    // joints: 不再写入（历史轨迹不需要关节数据，实时 3D 由 robotStore 直接消费）
    status: state.status,
    error_code: state.errorCode ?? null,
    // raw_msg: 不再写入（体积大，调试用，保留列以便后续需要但不填充）
  })

  if (error) console.error('[writeRobotState]', error)

  // ─── robots 表：30 秒节流 upsert（记录最新机器人概览）──────────────
  const lastUpsert = robotsUpsertThrottle.get(throttleKey) ?? 0
  if (now - lastUpsert >= ROBOTS_UPSERT_INTERVAL_MS) {
    robotsUpsertThrottle.set(throttleKey, now)
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
