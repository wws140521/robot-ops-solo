// 告警存储层 —— 告警写入 Supabase + 列表查询 + 标记已解决
// 对应 SUPABASE.md 第五节 5.3
import { supabase, isSupabaseEnabled, getCurrentTenantSlug } from './supabase'
import type { UnifiedAlert } from 'robot-adapter-kit'

// 写入告警（wsHub 收到 /alert 帧后调用）
export async function writeAlert(alert: UnifiedAlert) {
  if (!isSupabaseEnabled) return

  const tenantSlug = await getCurrentTenantSlug()

  const { error } = await supabase!.from('alerts').insert({
    robot_id: alert.robotId,
    tenant_slug: tenantSlug,
    level: alert.level,
    code: alert.code,
    message: alert.message,
  })

  if (error) console.error('[writeAlert]', error)
}

// 列出告警（AlertsPage 初始化用），unresolvedOnly=true 只看未解决
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

// 标记告警已解决
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
