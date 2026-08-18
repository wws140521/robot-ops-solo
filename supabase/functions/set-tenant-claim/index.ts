// @ts-nocheck — Deno 运行时文件，本地 tsc 不检查（部署时由 Supabase CLI 用 Deno 编译）
// Supabase Edge Function：把 tenant_slug 注入用户的 app_metadata（JWT 携带）
// 对应 SUPABASE.md 第四节 4.1 方案 A
// 部署：supabase functions deploy set-tenant-claim
// 调用：POST /functions/v1/set-tenant-claim  body: { "tenant_slug": "laowang" }
//       Authorization: Bearer <user_access_token>
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { tenant_slug } = await req.json()
    const authHeader = req.headers.get('Authorization')!

    // 用 service_role key 创建 admin 客户端（绕过 RLS）
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 从 JWT 解出 user id
    const jwt = authHeader.replace('Bearer ', '').split('.')[1]
    const payload = JSON.parse(atob(jwt))
    const userId = payload.sub

    // 用 admin API 更新用户的 app_metadata（JWT 会携带 app_metadata）
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { tenant_slug },
    })

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
