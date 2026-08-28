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
// 2026-08-28 两处修正：1) getUser() 每次调用都发 /auth/v1/user 网络请求，
// 未登录时被 WS 高频写入链路逐帧调用 → 每秒 ~30 次无效 401 请求 + 浏览器网络日志刷屏；
// 改用 getSession() 读本地会话（零网络开销）。2) 未登录返回 null，存储层据此跳过写入，
// 避免 RLS 逐帧拒绝产生的 [writeRobotState] error 洪泛
export async function getCurrentTenantSlug(): Promise<string | null> {
  if (!supabase) return import.meta.env.VITE_DEFAULT_TENANT ?? 'default'
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null // 未登录：存储层跳过写入，避免逐帧 401
  return (session.user.user_metadata as { tenant_slug?: string } | undefined)?.tenant_slug ?? 'default'
}
