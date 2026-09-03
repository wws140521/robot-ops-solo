// Supabase 客户端封装，没配 env 就走纯前端 mock 模式
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('[Supabase] 未配置 env，走纯前端 mock 模式（localStorage 降级）')
}

// supabase 实例，没配 env 就是 null，存储层靠这个判断要不要走降级
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

// 兼容旧调用，没启用 Supabase 就抛错
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('[Supabase] 未启用，请配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  }
  return supabase
}

// 拿当前登录用户的 tenant_slug
// 之前用 getUser() 每次都会发网络请求，未登录时被 WS 高频调用，每秒 30 几个 401，日志刷屏
// 现在改成 getSession() 读本地，没登录直接返回 null，存储层就跳过写入，避免 RLS 逐帧报错
export async function getCurrentTenantSlug(): Promise<string | null> {
  if (!supabase) return import.meta.env.VITE_DEFAULT_TENANT ?? 'default'
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null // 未登录：存储层跳过写入，避免逐帧 401
  return (session.user.user_metadata as { tenant_slug?: string } | undefined)?.tenant_slug ?? 'default'
}
