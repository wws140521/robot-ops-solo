// 告警存储层 —— 告警写入 Supabase + 列表查询 + 标记已解决
// 对应 SUPABASE.md 第五节 5.3
import { supabase, isSupabaseEnabled, getCurrentTenantSlug } from './supabase'
import type { UnifiedAlert } from 'robot-adapter-kit'

// ─── 告警去重：相同 robot_id + code 在 30 秒内只写一次 ──────────────────
// 避免机器人持续报同一错误时数据库被重复告警刷满
// 例如 low battery 每帧都触发 → 30 秒内只写一条
const alertDedupe = new Map<string, number>() // key → last write timestamp
const ALERT_DEDUPE_WINDOW_MS = 30_000 // 30 秒

// 未登录跳过提示只打一次
let skippedAlertWarned = false

// 写告警到 Supabase，带 30 秒去重，避免同一错误刷屏
export async function writeAlert(alert: UnifiedAlert) {
  if (!isSupabaseEnabled) return

  const tenantSlug = await getCurrentTenantSlug()
  if (!tenantSlug) {
    if (!skippedAlertWarned) {
      skippedAlertWarned = true
      console.warn('[writeAlert] 未登录，跳过 Supabase 写入（登录后自动恢复）')
    }
    return
  }

  // 去重检查
  const dedupeKey = `${alert.robotId}|${alert.code}|${tenantSlug}`
  const now = Date.now()
  const lastAlert = alertDedupe.get(dedupeKey)
  if (lastAlert && now - lastAlert < ALERT_DEDUPE_WINDOW_MS) {
    return // 重复告警，跳过
  }
  alertDedupe.set(dedupeKey, now)

  const { error } = await supabase!.from('alerts').insert({
    robot_id: alert.robotId,
    tenant_slug: tenantSlug,
    level: alert.level,
    code: alert.code,
    message: alert.message,
  })

  if (error) console.error('[writeAlert]', error)
}

// 列告警，AlertsPage 初始化用，unresolvedOnly=true 只看未解决
export async function listAlerts(unresolvedOnly = false) {
  if (!isSupabaseEnabled) return []

  let query = supabase!
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (unresolvedOnly) query = query.eq('resolved', false)

  const { data, error } = await query
  if (error) {
    console.error(error)
    return []
  }
  return data ?? []
}

// 把告警标成已解决
export async function resolveAlert(alertId: string) {
  if (!isSupabaseEnabled) return

  const { error } = await supabase!
    .from('alerts')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', alertId)

  if (error) console.error('[resolveAlert]', error)
}
