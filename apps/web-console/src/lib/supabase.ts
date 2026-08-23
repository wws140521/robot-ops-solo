// 2026-08-18 Supabase 客户端封装，未配置 env 时走离线降级，对应 SUPABASE.md 2.3
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('[Supabase] 未配置 env，走纯前端 mock 模式（localStorage 降级）')
}

// 可 null：未配置 env 时为 null，存储层据此走离线降级
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      })
    : null

export const isSupabaseEnabled = !!supabase

// 兼容旧调用：返回客户端实例，未启用时抛错提示
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('[Supabase] 未启用，请配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  }
  return supabase
}

// 拿当前登录用户的 tenant_slug（未登录或离线模式返回默认租户）
export async function getCurrentTenantSlug(): Promise<string> {
  if (!supabase) return import.meta.env.VITE_DEFAULT_TENANT ?? 'default'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return (user?.user_metadata as { tenant_slug?: string } | undefined)?.tenant_slug ?? 'default'
}
