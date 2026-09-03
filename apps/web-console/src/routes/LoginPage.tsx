import { useState } from 'react'
import { supabase, isSupabaseEnabled } from '../lib/supabase'

const LS_KEY = 'robotops_login'

// 读取本地记住的账号密码，读失败就返回空
function loadSavedLogin(): { email: string; password: string; remember: boolean } {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { email: '', password: '', remember: false }
}

// 登录页，支持密码登录和魔法链接
export function Login() {
  const saved = loadSavedLogin()
  const [email, setEmail] = useState(saved.email)
  const [password, setPassword] = useState(saved.password)
  const [remember, setRemember] = useState(saved.remember)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isSupabaseEnabled) {
    return (
      <div className="login-page">
        <div className="login-bg-grid" />
        <div className="login-bg-sphere" />
        <div className="login-bg-sphere login-bg-sphere--2" />
        <div className="login-bg-scan" />
        <div className="login-card">
          <div className="login-card__logo">
            <span className="login-card__logo-icon">🤖</span>
            <span className="login-card__logo-text">RobotOps</span>
          </div>
          <p className="login-card__desc">
            Supabase 未配置，当前为本地 mock 模式
          </p>
          <p className="login-card__hint">
            请配置 <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code> 后启用登录
          </p>
          <a href="/" className="login-btn login-btn--primary">
            返回首页（mock 模式）
          </a>
        </div>
      </div>
    )
  }

  // 密码登录，成功后根据 remember 决定是否存本地
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      // 勾了记住我就存一下，否则清掉
      if (remember) {
        localStorage.setItem(LS_KEY, JSON.stringify({ email, password, remember }))
      } else {
        localStorage.removeItem(LS_KEY)
      }
      window.location.href = '/'
    }
    setLoading(false)
  }

  // 魔法链接登录，免密码
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase!.auth.signInWithOtp({ email })
    if (error) setError(error.message)
    else setError('✅ 魔法链接已发送，请查收邮箱')
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-bg-grid" />
      <div className="login-bg-sphere" />
      <div className="login-bg-sphere login-bg-sphere--2" />
      <div className="login-bg-scan" />

      <form className="login-card" onSubmit={handleLogin}>
        <div className="login-card__logo">
          <span className="login-card__logo-icon">🤖</span>
          <span className="login-card__logo-text">RobotOps</span>
        </div>
        <div className="login-card__subtitle">机器人运营管理平台</div>

        <div className="login-field">
          <span className="login-field__icon">✉️</span>
          <input
            type="email"
            placeholder="邮箱"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
          />
        </div>

        <div className="login-field">
          <span className="login-field__icon">🔒</span>
          <input
            type="password"
            placeholder="密码"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />
        </div>

        <label className="login-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
          <span>记住账号</span>
        </label>

        {error && (
          <div
            className="login-error"
            style={{ color: error.startsWith('✅') ? 'var(--status-online)' : 'var(--status-error)' }}
          >
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="login-btn login-btn--primary">
          <span className="login-btn__scan" />
          {loading ? '登录中...' : '登 录'}
        </button>

        <button type="button" onClick={handleMagicLink} disabled={loading} className="login-btn login-btn--ghost">
          发送魔法链接（免密登录）
        </button>

        <a href="/signup" className="login-link">
          没有账号？去注册 →
        </a>
      </form>

      <style>{`
        .login-page {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          overflow: hidden;
          background: var(--bg-base);
          color: var(--text-primary);
        }

        .login-bg-grid {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(rgba(0, 240, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 240, 255, 0.04) 1px, transparent 1px);
          background-size: 48px 48px, 48px 48px;
          mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%);
        }

        .login-bg-sphere {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          border: 1px solid var(--primary-dim);
          top: 50%;
          left: 50%;
          margin-top: -260px;
          margin-left: -260px;
          animation: login-sphere-rotate 40s linear infinite;
          background:
            radial-gradient(circle at 30% 30%, var(--primary-dim), transparent 50%),
            radial-gradient(circle at 70% 70%, var(--accent-dim), transparent 50%);
        }

        .login-bg-sphere--2 {
          width: 360px;
          height: 360px;
          margin-top: -180px;
          margin-left: -180px;
          animation-duration: 60s;
          animation-direction: reverse;
          border-color: var(--accent-dim);
        }

        .login-bg-scan {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--primary), transparent);
          opacity: 0.5;
          animation: login-scan 4s linear infinite;
        }

        @keyframes login-sphere-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes login-scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(100vh); }
        }

        .login-card {
          position: relative;
          z-index: 1;
          width: 380px;
          padding: 36px 32px;
          border-radius: var(--radius-lg);
          background: var(--bg-glass);
          backdrop-filter: blur(20px) saturate(1.2);
          -webkit-backdrop-filter: blur(20px) saturate(1.2);
          border: 1px solid var(--border-base);
          box-shadow:
            0 0 0 1px var(--primary-dim),
            0 16px 48px rgba(0, 0, 0, 0.6),
            0 0 40px var(--primary-dim);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .login-card__logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 4px;
        }

        .login-card__logo-icon {
          font-size: 36px;
          filter: drop-shadow(0 0 12px var(--primary));
        }

        .login-card__logo-text {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .login-card__subtitle {
          text-align: center;
          font-size: 13px;
          color: var(--text-tertiary);
          margin-bottom: 8px;
        }

        .login-card__desc {
          text-align: center;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .login-card__hint {
          text-align: center;
          font-size: 13px;
          color: var(--text-tertiary);
          line-height: 1.6;
        }

        .login-field {
          position: relative;
          display: flex;
          align-items: center;
        }

        .login-field__icon {
          position: absolute;
          left: 12px;
          font-size: 14px;
          opacity: 0.6;
        }

        .login-input {
          width: 100%;
          padding: 12px 14px 12px 38px;
          border-radius: var(--radius-sm);
          background: var(--bg-elev-2);
          border: 1px solid var(--border-base);
          color: var(--text-primary);
          font-size: 14px;
          transition: all var(--dur-fast) var(--ease-out);
        }

        .login-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-dim);
          outline: none;
        }

        .login-remember {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-secondary);
          cursor: pointer;
          user-select: none;
        }

        .login-error {
          font-size: 13px;
          text-align: center;
          padding: 4px 0;
        }

        .login-btn {
          position: relative;
          padding: 12px 24px;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
          overflow: hidden;
          text-align: center;
          text-decoration: none;
          display: block;
          width: 100%;
          box-sizing: border-box;
        }

        .login-btn--primary {
          background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
          color: var(--bg-base);
          border: none;
          box-shadow: var(--glow-primary);
        }

        .login-btn--primary:hover {
          filter: brightness(1.1);
          box-shadow: var(--glow-primary-lg);
          transform: translateY(-1px);
        }

        .login-btn__scan {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          animation: login-btn-scan 2.5s ease-in-out infinite;
        }

        @keyframes login-btn-scan {
          0% { left: -100%; }
          50% { left: 100%; }
          100% { left: 100%; }
        }

        .login-btn--ghost {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-base);
        }

        .login-btn--ghost:hover {
          border-color: var(--primary);
          color: var(--text-primary);
        }

        .login-link {
          text-align: center;
          font-size: 13px;
          color: var(--text-tertiary);
          text-decoration: none;
        }

        .login-link:hover {
          color: var(--primary);
        }
      `}</style>
    </div>
  )
}