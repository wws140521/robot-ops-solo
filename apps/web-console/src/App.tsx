import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { TenantBranding } from './components/layout/TenantBranding'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './routes/Dashboard'
import { RobotsPage } from './routes/RobotsPage'
import { SopPage } from './routes/SopPage'
import { SopSimPage } from './routes/SopSimPage'
import { TwinPage } from './routes/TwinPage'
import { AlertsPage } from './routes/AlertsPage'
import { TenantsPage } from './routes/TenantsPage'
import { Login } from './routes/LoginPage'
import { SignUp } from './routes/SignUp'
import { startWS, stopAllWS } from './lib/wsHub'
import { SpeakBubble } from './components/overlays/SpeakBubble'
import { supabase, isSupabaseEnabled } from './lib/supabase'
import { subscribeAlerts } from './lib/realtime'
import { useAlertStore } from './stores/alertStore'
import { useRobotStore } from './stores/robotStore'
import { useThemeStore } from './stores/themeStore'
import { pushWebhook } from './lib/webhook'

// 主布局（侧边栏 + 受保护路由）
function MainLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/robots" element={<RobotsPage />} />
          <Route path="/robots/:id" element={<RobotsPage />} />
          <Route path="/sop" element={<SopPage />} />
          <Route path="/sop-sim" element={<SopSimPage />} />
          <Route path="/twin" element={<TwinPage />} />
          <Route path="/twin/:id" element={<TwinPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/tenants" element={<TenantsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseEnabled) // mock 模式无需等鉴权
  const applyTheme = useThemeStore((s) => s.applyTheme)

  // 初始化主题（从 localStorage 恢复 data-theme）
  useEffect(() => {
    applyTheme()
  }, [applyTheme])

  // 鉴权状态监听（仅 Supabase 启用时）
  useEffect(() => {
    if (!isSupabaseEnabled) return
    supabase!.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const {
      data: { subscription },
    } = supabase!.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // 登录后：启动 realtime 告警订阅 + 从 Supabase 加载机器人列表
  useEffect(() => {
    if (!isSupabaseEnabled || !session) return

    // 初始化机器人列表（从 robots 表）
    useRobotStore.getState().initFromSupabase()

    // 订阅新告警 → 写 store + 推 webhook
    const channel = subscribeAlerts((row) => {
      const r = row as {
        robot_id: string
        level: 'info' | 'warn' | 'error'
        code: string
        message: string
        created_at: string
      }
      useAlertStore.getState().addAlert({
        robotId: r.robot_id,
        level: r.level,
        code: r.code,
        message: r.message,
        timestamp: new Date(r.created_at).getTime(),
      })
      pushWebhook({
        level: r.level,
        code: r.code,
        message: r.message,
        robot_id: r.robot_id,
      })
    })

    return () => {
      if (channel) supabase!.removeChannel(channel)
    }
  }, [session])

  // 开发模式 mock WS（dev 环境始终启动，确保 3D 视图有数据；Supabase realtime 作为补充）
  useEffect(() => {
    if (import.meta.env.DEV) {
      startWS([
        { brand: 'unitree', url: 'ws://localhost:8080', robotId: 'g1-001' },
        { brand: 'keenon', url: 'ws://localhost:8081', robotId: 'peanut-001' },
        // 工业机器人 Mock（8082）：FANUC/KUKA/埃斯顿 轮流广播 industrial_state
        // 消息内含 brand 字段，wsHub 按 msg.brand 路由到 industrial 适配器
        { brand: 'fanuc', url: 'ws://localhost:8082', robotId: 'industrial-hub' },
      ])
    }
    return () => stopAllWS()
  }, [])

  // 鉴权未就绪时显示 loading
  if (!authReady) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-base)',
          color: 'white',
          fontSize: 16,
        }}
      >
        🤖 加载中...
      </div>
    )
  }

  // mock 模式（未启用 Supabase）：放行所有路由
  // Supabase 启用：未登录只能访问 /login /signup，其余重定向 /login
  const isAuthed = !isSupabaseEnabled || !!session

  return (
    <TenantBranding>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            path="/*"
            element={isAuthed ? <MainLayout /> : <Navigate to="/login" replace />}
          />
        </Routes>
        {/* 全局播报气泡，所有页面都能弹 */}
        <SpeakBubble />
      </BrowserRouter>
    </TenantBranding>
  )
}
