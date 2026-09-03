// 注册页：创建账号 + 绑定 tenant_slug + 建租户记录
import { useState } from 'react'
import { supabase, isSupabaseEnabled } from '../lib/supabase'

export function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Supabase 没配就显示离线提示
  if (!isSupabaseEnabled) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          style={{
            background: 'var(--bg-elev-2)',
            padding: 32,
            borderRadius: 16,
            width: 380,
            textAlign: 'center',
            border: '1px solid var(--border-base)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h2 style={{ marginTop: 0 }}>🚀 创建账号</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Supabase 未配置，无法注册。</p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: 16,
              padding: '10px 24px',
              background: 'var(--primary)',
              color: '#0a0e1a',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: 'var(--glow-primary)',
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

    // 1. 创建 auth 用户，把 tenant_slug 写进 user_metadata，RLS 靠这个隔离数据
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
      primary_color: '#39ff8b',
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
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
    >
      <form
        onSubmit={handleSignUp}
        style={{
          background: 'var(--bg-elev-2)',
          padding: 32,
          borderRadius: 16,
          width: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          border: '1px solid var(--border-base)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h2 style={{ margin: 0, textAlign: 'center' }}>🚀 创建账号</h2>

        <input
          type="email"
          placeholder="邮箱"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="密码（至少 6 位）"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          placeholder="租户标识（英文，如 laowang）"
          required
          value={tenantSlug}
          onChange={(e) =>
            setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
          }
        />

        <input
          placeholder="租户名称（如 老王机器人）"
          required
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
        />

        {message && (
          <div style={{ color: message.startsWith('✅') ? 'var(--status-online)' : 'var(--status-error)', fontSize: 13 }}>
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
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
            color: '#0a0e1a',
            fontSize: 15,
            cursor: 'pointer',
            fontWeight: 600,
            boxShadow: 'var(--glow-primary)',
          }}
        >
          {loading ? '创建中...' : '创建账号'}
        </button>

        <a href="/login" style={{ textAlign: 'center', color: 'var(--primary)', fontSize: 13, textDecoration: 'none' }}>
          已有账号？去登录 →
        </a>
      </form>
    </div>
  )
}
