// 注册页 —— 创建账号 + 绑定 tenant_slug + 建租户记录
// 对应 SUPABASE.md 第八节 8.2
import { useState } from 'react'
import { supabase, isSupabaseEnabled } from '../lib/supabase'

export function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // 离线模式提示
  if (!isSupabaseEnabled) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#0f172a',
          color: 'white',
        }}
      >
        <div
          style={{
            background: '#1e293b',
            padding: 32,
            borderRadius: 16,
            width: 380,
            textAlign: 'center',
          }}
        >
          <h2 style={{ marginTop: 0 }}>🚀 创建账号</h2>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Supabase 未配置，无法注册。</p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: 16,
              padding: '10px 24px',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            返回首页（mock 模式）
          </a>
        </div>
      </div>
    )
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    // 1. 创建 auth 用户，tenant_slug 写入 user_metadata（RLS 据此隔离）
    const { error } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: { tenant_slug: tenantSlug },
      },
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    // 2. 在 tenants 表插入租户记录
    const { error: tenantError } = await supabase!.from('tenants').insert({
      slug: tenantSlug,
      name: tenantName,
      primary_color: '#3b82f6',
    })

    if (tenantError) {
      setMessage('注册成功但租户创建失败：' + tenantError.message)
    } else {
      setMessage('✅ 注册成功！请查收验证邮件后登录')
    }

    setLoading(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0f172a',
        color: 'white',
      }}
    >
      <form
        onSubmit={handleSignUp}
        style={{
          background: '#1e293b',
          padding: 32,
          borderRadius: 16,
          width: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h2 style={{ margin: 0, textAlign: 'center' }}>🚀 创建账号</h2>

        <input
          type="email"
          placeholder="邮箱"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: 'none', fontSize: 14 }}
        />

        <input
          type="password"
          placeholder="密码（至少 6 位）"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: 'none', fontSize: 14 }}
        />

        <input
          placeholder="租户标识（英文，如 laowang）"
          required
          value={tenantSlug}
          onChange={(e) =>
            setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
          }
          style={{ padding: 12, borderRadius: 8, border: 'none', fontSize: 14 }}
        />

        <input
          placeholder="租户名称（如 老王机器人）"
          required
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: 'none', fontSize: 14 }}
        />

        {message && (
          <div style={{ color: message.startsWith('✅') ? '#34d399' : '#f87171', fontSize: 13 }}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 8,
            border: 'none',
            background: '#3b82f6',
            color: 'white',
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          {loading ? '创建中...' : '创建账号'}
        </button>

        <a href="/login" style={{ textAlign: 'center', color: '#60a5fa', fontSize: 13, textDecoration: 'none' }}>
          已有账号？去登录 →
        </a>
      </form>
    </div>
  )
}
